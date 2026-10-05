import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { NgTemplateOutlet } from '@angular/common';
import {
  ClubForecast,
  ClubView,
  CreateBookingRequest,
  PlayerSearchResult,
  SlotPlayer,
  WeatherBlock,
  Week,
} from '../../core/models';
import { addDays, dayMonthLabel, daysUntil, todayIso, weekdayLabel } from '../../core/date-utils';
import { forkJoin, of, catchError } from 'rxjs';
import { PlayerSearch } from '../../shared/player-search';

type CellState = 'closed' | 'booked' | 'free' | 'past' | 'mine' | 'queued-mine' | 'queued-other';

interface CellView {
  time: number;
  timeFmt: string;
  state: CellState;
  price: number | null;
  bookedBy: string | null;
  shortName: string | null;
  queuedBy: string | null;
  players: SlotPlayer[];
}

/** One cell of the forecast sub-row; spans the slot columns its forecast block covers. */
interface WeatherCell {
  colspan: number;
  symbol: string | null;
  temp: number | null;
  title: string;
}

interface RowView {
  date: string;
  weekday: string;
  dayMonth: string;
  beyondWindow: boolean;
  cells: CellView[];
  weather: WeatherCell[] | null; // null = no forecast row (indoor court or no data for the club)
}

interface CourtView {
  clubId: number;
  clubName: string;
  courtId: number;
  courtName: string;
  type: string;
  slotMinutes: number;
  times: { time: number; timeFmt: string }[];
  rows: RowView[];
}

interface ClubSectionView {
  clubId: number;
  clubName: string;
  error: boolean;
  spanDays: number;
  courts: CourtView[];
}

interface HoverInfo {
  heading: string | null;
  players: SlotPlayer[];
  x: number;
  y: number;
}

interface DialogSlot {
  time: number;
  timeFmt: string;
  price: number | null;
}

interface DialogState {
  clubId: number;
  courtId: number;
  courtName: string;
  slotMinutes: number;
  date: string;
  whenLabel: string;
  consecutive: DialogSlot[]; // free consecutive slots from the clicked start
  minSlots: number;
  maxSlots: number;
  length: number;
  beyondWindow: boolean;
  repeatWeekly: boolean;
}

@Component({
  selector: 'app-availability',
  imports: [FormsModule, PlayerSearch, NgTemplateOutlet],
  templateUrl: './availability.html',
  styleUrl: './availability.scss',
})
export class Availability implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  readonly isAdmin = this.auth.isAdmin;

  weekStart = signal<string>(todayIso());
  clubs = signal<ClubView[]>([]);
  selectedClubIds = signal<Set<number>>(new Set());
  selectedCourtIds = signal<Set<number>>(new Set()); // empty = all visible
  hiddenCourts = signal<Record<string, number[]>>({});
  indoorCourts = signal<Record<string, number[]>>({});
  /** Forecast blocks per club (served from the backend's daily cache). */
  weather = signal<Record<number, WeatherBlock[]>>({});
  weatherFetchedAt = signal<string | null>(null);
  refreshingWeather = signal(false);
  /** All courts per club (id+name) for the picker — from the cheap courts endpoint, cached per session. */
  private clubCourts = signal<Record<number, { id: number; name: string }[]>>({});

  private rawWeek = signal<Week | null>(null);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  message = signal<string | null>(null);
  hovered = signal<HoverInfo | null>(null);
  showPicker = signal<boolean>(false);

  dialog = signal<DialogState | null>(null);
  submitting = signal<boolean>(false);
  partners = signal<PlayerSearchResult[]>([]);
  readonly maxPartners = 3;

  /** Courts available to toggle, grouped by selected club (respecting hidden). From the full court list. */
  readonly courtChoices = computed(() => {
    const hidden = this.hiddenCourts();
    const cc = this.clubCourts();
    return [...this.selectedClubIds()].map((clubId) => ({
      clubId,
      clubName: this.clubName(clubId),
      courts: (cc[clubId] ?? []).filter((ct) => !(hidden[String(clubId)] ?? []).includes(ct.id)),
    }));
  });

  readonly sections = computed<ClubSectionView[]>(() => this.buildView(this.rawWeek()));

  ngOnInit(): void {
    this.loading.set(true);
    this.api.clubs().subscribe({
      next: (clubs) => {
        this.clubs.set(clubs);
        this.api.getCourtPrefs().subscribe({
          next: (cp) => {
            this.hiddenCourts.set(cp?.hidden ?? {});
            this.indoorCourts.set(cp?.indoor ?? {});
          },
          error: () => {},
        });
        this.api.getAvailabilityPrefs().subscribe({
          next: (prefs) => {
            const available = new Set(clubs.map((c) => c.clubId));
            const defClubs = (prefs?.clubs ?? []).filter((id) => available.has(id));
            this.selectedClubIds.set(new Set(defClubs.length ? defClubs : clubs.map((c) => c.clubId)));
            this.selectedCourtIds.set(new Set(prefs?.courts ?? []));
            this.load();
          },
          error: () => {
            this.selectedClubIds.set(new Set(clubs.map((c) => c.clubId)));
            this.load();
          },
        });
      },
      error: (e) => {
        this.error.set(this.errMsg(e));
        this.loading.set(false);
      },
    });
  }

  clubName(id: number): string {
    return this.clubs().find((c) => c.clubId === id)?.name ?? `Club ${id}`;
  }

  load(): void {
    const clubIds = [...this.selectedClubIds()];
    if (!clubIds.length) {
      this.rawWeek.set({ from: this.weekStart(), to: addDays(this.weekStart(), 6), clubs: [] });
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.loadWeather(clubIds); // in parallel; served from the backend's daily cache
    // Need each club's court list first so we know which court ids to fetch availability for.
    this.ensureCourtLists(clubIds, () => {
      const from = this.weekStart();
      const to = addDays(from, 6);
      const courts = this.courtsToFetch(); // only the courts actually shown → scoped upstream fetch
      this.api.availability(clubIds, courts, from, to).subscribe({
        next: (w) => {
          this.rawWeek.set(w);
          this.loading.set(false);
        },
        error: (e) => {
          this.error.set(this.errMsg(e));
          this.loading.set(false);
        },
      });
    });
  }

  private loadWeather(clubIds: number[]): void {
    this.api.weather(clubIds).subscribe({
      next: (f) => this.applyForecasts(f),
      error: () => {}, // weather is best-effort; the grid works without it
    });
  }

  /** "Refresh forecast": ask the backend to refetch from MET/Open-Meteo (throttled server-side). */
  refreshForecast(): void {
    const clubIds = [...this.selectedClubIds()];
    if (!clubIds.length) return;
    this.refreshingWeather.set(true);
    this.api.refreshWeather(clubIds).subscribe({
      next: (f) => {
        this.applyForecasts(f);
        this.refreshingWeather.set(false);
        this.flash('Forecast updated.');
      },
      error: (e) => {
        this.refreshingWeather.set(false);
        this.error.set(this.errMsg(e));
      },
    });
  }

  private applyForecasts(forecasts: ClubForecast[]): void {
    const next = { ...this.weather() };
    let latest: string | null = null;
    for (const f of forecasts) {
      next[f.clubId] = f.blocks;
      if (!latest || f.fetchedAt > latest) latest = f.fetchedAt;
    }
    this.weather.set(next);
    this.weatherFetchedAt.set(latest);
  }

  weatherUpdatedLabel(): string {
    const at = this.weatherFetchedAt();
    if (!at) return 'Refresh forecast';
    const t = new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `Forecast updated ${t} — click to refresh`;
  }

  /** Fetch (and cache for the session) the full court list for any clubs we don't have yet. */
  private ensureCourtLists(clubIds: number[], done: () => void): void {
    const missing = clubIds.filter((id) => !this.clubCourts()[id]);
    if (!missing.length) {
      done();
      return;
    }
    forkJoin(
      missing.map((id) =>
        this.api.courts(id).pipe(catchError(() => of({ data: [] as { id: number; name: string }[] }))),
      ),
    ).subscribe((results) => {
      const next = { ...this.clubCourts() };
      missing.forEach((id, i) => {
        const r = results[i] as { data?: { id: number; name: string }[] } | { id: number; name: string }[];
        const arr = Array.isArray(r) ? r : (r?.data ?? []);
        next[id] = arr.map((c) => ({ id: c.id, name: c.name }));
      });
      this.clubCourts.set(next);
      done();
    });
  }

  /** The court ids currently shown (visible, not hidden, and selected if a selection is active). */
  private courtsToFetch(): number[] {
    const sel = this.selectedCourtIds();
    const hidden = this.hiddenCourts();
    const out: number[] = [];
    for (const clubId of this.selectedClubIds()) {
      const hid = hidden[String(clubId)] ?? [];
      for (const c of this.clubCourts()[clubId] ?? []) {
        if (hid.includes(c.id)) continue;
        if (sel.size === 0 || sel.has(c.id)) out.push(c.id);
      }
    }
    return out;
  }

  toggleClub(id: number): void {
    const next = new Set(this.selectedClubIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selectedClubIds.set(next);
    this.load(); // changing clubs needs a refetch
  }

  toggleCourt(id: number): void {
    const next = new Set(this.selectedCourtIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selectedCourtIds.set(next);
    this.load(); // scoped fetch: showing a court means fetching it
  }

  courtShown(id: number): boolean {
    const sel = this.selectedCourtIds();
    return sel.size === 0 || sel.has(id);
  }

  saveDefaultView(): void {
    this.api
      .putAvailabilityPrefs({ clubs: [...this.selectedClubIds()], courts: [...this.selectedCourtIds()] })
      .subscribe({
        next: () => this.flash('Saved as your default view.'),
        error: (e) => this.error.set(this.errMsg(e)),
      });
  }

  prevWeek(): void {
    this.weekStart.set(addDays(this.weekStart(), -7));
    this.load();
  }

  nextWeek(): void {
    this.weekStart.set(addDays(this.weekStart(), 7));
    this.load();
  }

  onDateChange(value: string): void {
    if (value) {
      this.weekStart.set(value);
      this.load();
    }
  }

  // --- booking dialog ---

  openBooking(court: CourtView, row: RowView, startIndex: number): void {
    const cell = row.cells[startIndex];
    if (!cell || cell.state !== 'free') return;
    const club = this.clubs().find((c) => c.clubId === court.clubId);
    const minSlots = club?.minSlots ?? 1;
    const maxSlots = club?.maxSlots ?? 1;
    const step = Math.round((court.slotMinutes / 60) * 100);

    // Walk forward collecting consecutive free slots (by time code step).
    const consecutive: DialogSlot[] = [];
    let expected = cell.time;
    for (let i = startIndex; i < row.cells.length && consecutive.length < maxSlots; i++) {
      const c = row.cells[i];
      if (c.state !== 'free' || c.time !== expected) break;
      consecutive.push({ time: c.time, timeFmt: c.timeFmt, price: c.price });
      expected += step;
    }
    if (consecutive.length < minSlots) {
      this.error.set(`Not enough consecutive free slots here (need ${minSlots}).`);
      return;
    }
    this.error.set(null);
    this.message.set(null);
    this.partners.set([]);
    this.dialog.set({
      clubId: court.clubId,
      courtId: court.courtId,
      courtName: court.courtName,
      slotMinutes: court.slotMinutes,
      date: row.date,
      whenLabel: `${court.clubName} · ${court.courtName} — ${row.weekday} ${row.dayMonth}`,
      consecutive,
      minSlots,
      maxSlots: Math.min(maxSlots, consecutive.length),
      length: minSlots,
      beyondWindow: row.beyondWindow,
      repeatWeekly: false,
    });
  }

  setLength(n: number): void {
    const d = this.dialog();
    if (!d) return;
    this.dialog.set({ ...d, length: Math.max(d.minSlots, Math.min(d.maxSlots, n)) });
  }

  setRepeat(v: boolean): void {
    const d = this.dialog();
    if (!d) return;
    this.dialog.set({ ...d, repeatWeekly: v });
  }

  addPartner(p: PlayerSearchResult): void {
    const cur = this.partners();
    if (cur.length >= this.maxPartners) return;
    if (cur.some((x) => x.playerId === p.playerId)) return;
    this.partners.set([...cur, p]);
  }

  removePartner(playerId: number): void {
    this.partners.set(this.partners().filter((p) => p.playerId !== playerId));
  }

  dialogSlots(): DialogSlot[] {
    const d = this.dialog();
    return d ? d.consecutive.slice(0, d.length) : [];
  }

  dialogRange(): string {
    const d = this.dialog();
    if (!d) return '';
    const slots = this.dialogSlots();
    const start = slots[0]?.timeFmt ?? '';
    const endMinutes = this.codeToMinutes(slots[slots.length - 1].time) + d.slotMinutes;
    return `${start}–${this.minutesToFmt(endMinutes)}`;
  }

  dialogTotal(): number {
    return this.dialogSlots().reduce((sum, s) => sum + (s.price ?? 0), 0);
  }

  dialogDuration(): string {
    const d = this.dialog();
    if (!d) return '';
    const total = d.length * d.slotMinutes;
    const h = Math.floor(total / 60);
    const m = total % 60;
    return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  }

  closeDialog(): void {
    this.dialog.set(null);
  }

  submitDialog(): void {
    const d = this.dialog();
    if (!d) return;
    this.submitting.set(true);
    const slots = this.dialogSlots().map((s) => ({ time: s.time, price: s.price }));
    const req: CreateBookingRequest = {
      clubId: d.clubId,
      courtId: d.courtId,
      courtName: d.courtName,
      playDate: d.date,
      slotMinutes: d.slotMinutes,
      slots,
      repeatWeekly: d.repeatWeekly,
      partnerPlayerIds: this.partners().map((p) => p.playerId),
    };
    const label = `${d.whenLabel} ${this.dialogRange()}`;
    const done = () => {
      this.submitting.set(false);
      this.closeDialog();
      this.load();
    };
    // Fixed weekly and beyond-window both schedule; within-window one-off reserves immediately.
    if (d.repeatWeekly || d.beyondWindow) {
      this.api.createBooking(req).subscribe({
        next: (b) => {
          this.message.set(
            d.repeatWeekly
              ? `Standing weekly booking created: ${label}. Next fires ${new Date(b.targetFireAt).toLocaleString()}.`
              : `Scheduled: ${label}. Fires ${new Date(b.targetFireAt).toLocaleString()}.`,
          );
          done();
        },
        error: (e) => {
          this.error.set(this.errMsg(e));
          this.submitting.set(false);
        },
      });
    } else {
      this.api.reserveNow(req).subscribe({
        next: (res) => {
          if (res.success) this.message.set(`Reserved: ${label}. ${res.message}`);
          else this.error.set(`Could not reserve ${label}: ${res.message}`);
          done();
        },
        error: (e) => {
          this.error.set(this.errMsg(e));
          this.submitting.set(false);
        },
      });
    }
  }

  // --- view building ---

  private buildView(w: Week | null): ClubSectionView[] {
    if (!w) return [];
    return w.clubs.map((section) => {
      const club = this.clubs().find((c) => c.clubId === section.clubId);
      const span = club?.maxSpanDays ?? 7;
      const hiddenForClub = this.hiddenCourts()[String(section.clubId)] ?? [];
      const courts = section.courts
        .filter((c) => !hiddenForClub.includes(c.courtId)) // hidden in Settings → never show
        .filter((c) => this.courtShown(c.courtId)) // availability default-view selection
        .map((c) => this.buildCourt(section, c, span));
      return {
        clubId: section.clubId,
        clubName: section.clubName,
        error: section.error,
        spanDays: span,
        courts,
      };
    });
  }

  private buildCourt(
    section: Week['clubs'][number],
    c: Week['clubs'][number]['courts'][number],
    span: number,
  ): CourtView {
    const timeMap = new Map<number, string>();
    for (const day of c.days) for (const s of day.slots) timeMap.set(s.time, s.timeFmt);
    const times = [...timeMap.entries()].sort((a, b) => a[0] - b[0]).map(([time, timeFmt]) => ({ time, timeFmt }));

    // Forecast row: skipped for indoor courts and when the club has no forecast data at all.
    const indoor = (this.indoorCourts()[String(section.clubId)] ?? []).includes(c.courtId);
    const blocks = indoor ? [] : this.parsedBlocks(this.weather()[section.clubId] ?? []);

    const rows: RowView[] = c.days.map((day) => {
      const slotByTime = new Map(day.slots.map((s) => [s.time, s]));
      const beyond = daysUntil(day.date) > span;
      const cells: CellView[] = times.map((t) => {
        const slot = slotByTime.get(t.time);
        let state: CellState;
        let price: number | null = null;
        if (!slot) {
          state = 'closed';
        } else if (slot.booked) {
          state = slot.mine ? 'mine' : 'booked';
        } else if (slot.queued) {
          state = slot.queuedByMe ? 'queued-mine' : 'queued-other';
        } else if (this.isPast(day.date, t.time)) {
          state = 'past';
        } else {
          state = 'free';
          price = slot.price;
        }
        const bookedBy = slot?.bookedBy ?? null;
        return {
          time: t.time,
          timeFmt: t.timeFmt,
          state,
          price,
          bookedBy,
          shortName: bookedBy ? bookedBy.split(' ')[0] : null,
          queuedBy: slot?.queuedBy ?? null,
          players: slot?.players ?? [],
        };
      });
      return {
        date: day.date,
        weekday: weekdayLabel(day.date),
        dayMonth: dayMonthLabel(day.date),
        beyondWindow: beyond,
        cells,
        weather: blocks.length ? this.weatherCells(day.date, times, blocks) : null,
      };
    });

    return {
      clubId: section.clubId,
      clubName: section.clubName,
      courtId: c.courtId,
      courtName: c.courtName,
      type: c.type,
      slotMinutes: c.reservationDuration,
      times,
      rows,
    };
  }

  /** Blocks with start/end as naive-local minutes, for interval lookups against slot times. */
  private parsedBlocks(blocks: WeatherBlock[]): { b: WeatherBlock; start: number; end: number }[] {
    return blocks.map((b) => {
      const start = this.localMinutes(b.start);
      return { b, start, end: start + b.hours * 60 };
    });
  }

  /**
   * Map forecast blocks onto a day's slot columns: each column takes the block covering its START time
   * (so a 90-min Modesto slot shows its start hour), and neighbouring columns in the same block merge
   * into one cell (an hour = 2 Silax columns; a 6-hour block spans many).
   */
  private weatherCells(
    date: string,
    times: { time: number; timeFmt: string }[],
    blocks: { b: WeatherBlock; start: number; end: number }[],
  ): WeatherCell[] {
    const dayStart = this.localMinutes(`${date}T00:00`);
    const cells: (WeatherCell & { key: string })[] = [];
    for (const t of times) {
      const at = dayStart + this.codeToMinutes(t.time);
      const hit = blocks.find((x) => x.start <= at && at < x.end);
      const key = hit ? hit.b.start : 'none';
      const last = cells[cells.length - 1];
      if (last && last.key === key) {
        last.colspan++;
        continue;
      }
      cells.push({
        key,
        colspan: 1,
        symbol: hit ? hit.b.symbol : null,
        temp: hit && hit.b.tempC != null ? Math.round(hit.b.tempC) : null,
        title: hit ? this.blockTitle(hit.b) : '',
      });
    }
    if (cells.length === 1 && cells[0].key === 'none') cells[0].title = 'No forecast yet';
    return cells.map(({ key, ...c }) => c);
  }

  private blockTitle(b: WeatherBlock): string {
    const from = b.start.slice(11, 16);
    const to = this.minutesToFmt((this.localMinutes(b.start) + b.hours * 60) % (24 * 60));
    const range = b.hours === 1 ? from : `${from}–${to}`;
    const src = b.source === 'met' ? 'MET Norway' : 'Open-Meteo';
    const temp = b.tempC != null ? ` · ${Math.round(b.tempC)}°C` : '';
    return `${range}${temp} · ${b.symbol.replace(/_(day|night)$/, '').replace(/([a-z])(and|showers|thunder)/g, '$1 $2')} (${src})`;
  }

  /** "yyyy-MM-ddTHH:mm" as minutes on a naive local timeline (DST-free arithmetic is fine here). */
  private localMinutes(s: string): number {
    const [d, tm] = s.split('T');
    const [y, m, day] = d.split('-').map(Number);
    const [hh, mm] = (tm ?? '00:00').split(':').map(Number);
    return Date.UTC(y, m - 1, day, hh, mm) / 60000;
  }

  onEnter(cell: CellView, event: MouseEvent): void {
    let heading: string | null = null;
    let players: SlotPlayer[] = [];
    if (cell.state === 'booked' || cell.state === 'mine') {
      if (!cell.bookedBy && cell.players.length === 0) return;
      heading = cell.bookedBy ? `Booked by ${cell.bookedBy}` : null;
      players = cell.players;
    } else if (cell.state === 'queued-mine' || cell.state === 'queued-other') {
      heading = `Held by ${cell.queuedBy ?? 'someone'}`;
    } else {
      return;
    }
    const el = event.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const x = Math.min(rect.left, window.innerWidth - 240);
    this.hovered.set({ heading, players, x, y: rect.bottom + 6 });
  }

  onLeave(): void {
    this.hovered.set(null);
  }

  private flash(msg: string): void {
    this.message.set(msg);
    setTimeout(() => {
      if (this.message() === msg) this.message.set(null);
    }, 3000);
  }

  private isPast(date: string, timeCode: number): boolean {
    const now = new Date();
    const [y, m, d] = date.split('-').map(Number);
    const slot = new Date(y, m - 1, d, Math.floor(timeCode / 100), this.codeMinutePart(timeCode));
    return slot.getTime() < now.getTime();
  }

  private codeMinutePart(code: number): number {
    return Math.round((code % 100) * 0.6);
  }

  private codeToMinutes(code: number): number {
    return Math.floor(code / 100) * 60 + this.codeMinutePart(code);
  }

  private minutesToFmt(total: number): string {
    const h = Math.floor(total / 60) % 24;
    const m = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  private errMsg(e: unknown): string {
    const err = e as { error?: { message?: string }; message?: string };
    return err?.error?.message || err?.message || 'Request failed';
  }
}
