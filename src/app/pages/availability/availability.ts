import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { CreateBookingRequest, Week } from '../../core/models';
import { addDays, dayMonthLabel, daysUntil, todayIso, weekdayLabel } from '../../core/date-utils';

type CellState = 'closed' | 'booked' | 'free' | 'past';

interface CellView {
  time: number;
  timeFmt: string;
  state: CellState;
  price: number | null;
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

  weekStart = signal<string>(todayIso());
  courts = signal<CourtView[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  message = signal<string | null>(null);

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

  queue(court: CourtView, row: RowView, cell: CellView): void {
    if (cell.state !== 'free') return;
    const when = `${court.courtName} — ${row.weekday} ${row.dayMonth} at ${cell.timeFmt}`;
    const info = row.beyondWindow
      ? `This is more than a week out. It will be auto-booked at midnight when the day opens.`
      : `This day is already open, so it will be booked immediately.`;
    if (!confirm(`Queue booking?\n\n${when}\nPrice: ${cell.price ?? '?'}\n\n${info}`)) return;

    const req: CreateBookingRequest = {
      courtId: court.courtId,
      courtName: court.courtName,
      playDate: row.date,
      slotTime: cell.time,
    };
    this.message.set(null);
    this.error.set(null);
    this.api.createBooking(req).subscribe({
      next: (b) => {
        this.message.set(
          `Queued #${b.id}: ${when}. Fires at ${new Date(b.targetFireAt).toLocaleString()}.`,
        );
        this.load();
      },
      error: (e) => this.error.set(this.errMsg(e)),
    });
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
            state = 'booked';
          } else if (this.isPast(day.date, t.time)) {
            state = 'past';
          } else {
            state = 'free';
            price = slot.price;
          }
          return { time: t.time, timeFmt: t.timeFmt, state, price };
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

  private isPast(date: string, hhmm: number): boolean {
    const now = new Date();
    const [y, m, d] = date.split('-').map(Number);
    const slot = new Date(y, m - 1, d, Math.floor(hhmm / 100), hhmm % 100);
    return slot.getTime() < now.getTime();
  }

  private errMsg(e: unknown): string {
    const err = e as { error?: { message?: string }; message?: string };
    return err?.error?.message || err?.message || 'Request failed';
  }
}
