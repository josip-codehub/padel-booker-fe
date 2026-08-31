import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { ConfirmService } from '../../core/confirm.service';
import { CreateBookingRequest, SlotPlayer, Week } from '../../core/models';
import { addDays, dayMonthLabel, daysUntil, todayIso, weekdayLabel } from '../../core/date-utils';

type CellState = 'closed' | 'booked' | 'free' | 'past' | 'mine' | 'queued';

interface CellView {
  time: number;
  timeFmt: string;
  state: CellState;
  price: number | null;
  bookedBy: string | null;
  shortName: string | null;
  players: SlotPlayer[];
}

interface HoverInfo {
  bookedBy: string | null;
  players: SlotPlayer[];
  x: number;
  y: number;
}

interface RowView {
  date: string;
  weekday: string;
  dayMonth: string;
  beyondWindow: boolean;
  cells: CellView[];
}

interface CourtView {
  courtId: number;
  courtName: string;
  type: string;
  times: { time: number; timeFmt: string }[];
  rows: RowView[];
}

@Component({
  selector: 'app-availability',
  imports: [FormsModule],
  templateUrl: './availability.html',
  styleUrl: './availability.scss',
})
export class Availability implements OnInit {
  private api = inject(ApiService);
  private confirm = inject(ConfirmService);

  weekStart = signal<string>(todayIso());
  courts = signal<CourtView[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  message = signal<string | null>(null);
  hovered = signal<HoverInfo | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    const from = this.weekStart();
    const to = addDays(from, 6);
    this.api.availability(from, to).subscribe({
      next: (w) => {
        this.courts.set(this.buildView(w));
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(this.errMsg(e));
        this.loading.set(false);
      },
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

  async book(court: CourtView, row: RowView, cell: CellView): Promise<void> {
    if (cell.state !== 'free') return;
    const when = `${court.courtName} — ${row.weekday} ${row.dayMonth} at ${cell.timeFmt}`;
    const req: CreateBookingRequest = {
      courtId: court.courtId,
      courtName: court.courtName,
      playDate: row.date,
      slotTime: cell.time,
    };
    this.message.set(null);
    this.error.set(null);

    if (row.beyondWindow) {
      // More than a week out → schedule the midnight booking.
      const ok = await this.confirm.ask({
        title: 'Schedule booking',
        message: `${when}\nPrice: ${cell.price ?? '?'}\n\nThis is more than a week out — it will be auto-booked at midnight when the day opens.`,
        confirmText: 'Schedule',
      });
      if (!ok) return;
      this.api.createBooking(req).subscribe({
        next: (b) => {
          this.message.set(`Queued #${b.id}: ${when}. Fires at ${new Date(b.targetFireAt).toLocaleString()}.`);
          this.load();
        },
        error: (e) => this.error.set(this.errMsg(e)),
      });
    } else {
      // Already inside the window → reserve immediately.
      const ok = await this.confirm.ask({
        title: 'Reserve now',
        message: `${when}\nPrice: ${cell.price ?? '?'}\n\nThis books the court immediately.`,
        confirmText: 'Reserve',
      });
      if (!ok) return;
      this.api.reserveNow(req).subscribe({
        next: (res) => {
          if (res.success) {
            this.message.set(`Reserved: ${when}. ${res.message}`);
          } else {
            this.error.set(`Could not reserve ${when}: ${res.message}`);
          }
          this.load();
        },
        error: (e) => this.error.set(this.errMsg(e)),
      });
    }
  }

  private buildView(w: Week): CourtView[] {
    return w.courts.map((c) => {
      // union of all slot times across the week, sorted
      const timeMap = new Map<number, string>();
      for (const day of c.days) {
        for (const s of day.slots) timeMap.set(s.time, s.timeFmt);
      }
      const times = [...timeMap.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([time, timeFmt]) => ({ time, timeFmt }));

      const rows: RowView[] = c.days.map((day) => {
        const slotByTime = new Map(day.slots.map((s) => [s.time, s]));
        const beyond = daysUntil(day.date) > 7;
        const cells: CellView[] = times.map((t) => {
          const slot = slotByTime.get(t.time);
          let state: CellState;
          let price: number | null = null;
          if (!slot) {
            state = 'closed';
          } else if (slot.booked) {
            state = slot.mine ? 'mine' : 'booked';
          } else if (slot.queued) {
            state = 'queued';
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

      return { courtId: c.courtId, courtName: c.courtName, type: c.type, times, rows };
    });
  }

  onEnter(cell: CellView, event: MouseEvent): void {
    if (cell.state !== 'booked' && cell.state !== 'mine') return;
    if (!cell.bookedBy && cell.players.length === 0) return;
    const el = event.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const x = Math.min(rect.left, window.innerWidth - 240);
    this.hovered.set({ bookedBy: cell.bookedBy, players: cell.players, x, y: rect.bottom + 6 });
  }

  onLeave(): void {
    this.hovered.set(null);
  }

  private isPast(date: string, timeCode: number): boolean {
    // timeCode is decimal-hours x100: 1450 -> 14:30, 700 -> 07:00
    const now = new Date();
    const [y, m, d] = date.split('-').map(Number);
    const hour = Math.floor(timeCode / 100);
    const minute = Math.round((timeCode % 100) * 0.6);
    const slot = new Date(y, m - 1, d, hour, minute);
    return slot.getTime() < now.getTime();
  }

  private errMsg(e: unknown): string {
    const err = e as { error?: { message?: string }; message?: string };
    return err?.error?.message || err?.message || 'Request failed';
  }
}
