import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ClubView, CreateBookingRequest, SlotPlayer, Week } from '../../core/models';
import { addDays, dayMonthLabel, daysUntil, todayIso, weekdayLabel } from '../../core/date-utils';

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

interface RowView {
  date: string;
  weekday: string;
  dayMonth: string;
  beyondWindow: boolean;
  cells: CellView[];
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
  imports: [FormsModule],
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

  private rawWeek = signal<Week | null>(null);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  message = signal<string | null>(null);
  hovered = signal<HoverInfo | null>(null);
  showPicker = signal<boolean>(false);

  dialog = signal<DialogState | null>(null);
  submitting = signal<boolean>(false);

  /** Courts available to toggle, grouped by selected club (respecting hidden). */
  readonly courtChoices = computed(() => {
    const w = this.rawWeek();
    if (!w) return [] as { clubId: number; clubName: string; courts: { id: number; name: string }[] }[];
    const hidden = this.hiddenCourts();
    return w.clubs.map((c) => ({
      clubId: c.clubId,
      clubName: c.clubName,
      courts: c.courts
        .filter((ct) => !(hidden[String(c.clubId)] ?? []).includes(ct.courtId))
        .map((ct) => ({ id: ct.courtId, name: ct.courtName })),
    }));
  });

  readonly sections = computed<ClubSectionView[]>(() => this.buildView(this.rawWeek()));

  ngOnInit(): void {
    this.loading.set(true);
    this.api.clubs().subscribe({
      next: (clubs) => {
        this.clubs.set(clubs);
        this.api.getCourtPrefs().subscribe({
          next: (cp) => this.hiddenCourts.set(cp?.hidden ?? {}),
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
    const from = this.weekStart();
    const to = addDays(from, 6);
    this.api.availability(clubIds, [], from, to).subscribe({
      next: (w) => {
        this.rawWeek.set(w);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(this.errMsg(e));
        this.loading.set(false);
      },
    });
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
    this.selectedCourtIds.set(next); // client-side filter, no refetch
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
