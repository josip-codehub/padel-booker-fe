import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { MyReservation } from '../../core/models';
import { todayIso, weekdayLabel } from '../../core/date-utils';

@Component({
  selector: 'app-my-reservations',
  imports: [FormsModule],
  templateUrl: './my-reservations.html',
  styleUrl: './my-reservations.scss',
})
export class MyReservations implements OnInit {
  private api = inject(ApiService);

  from = signal<string>(todayIso());
  reservations = signal<MyReservation[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  message = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.myReservations(this.from()).subscribe({
      next: (r) => {
        this.reservations.set(r);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(this.errMsg(e));
        this.loading.set(false);
      },
    });
  }

  onFromChange(value: string): void {
    if (value) {
      this.from.set(value);
      this.load();
    }
  }

  weekday(date: string): string {
    return weekdayLabel(date);
  }

  cancel(r: MyReservation): void {
    const when = `${r.courtName} — ${r.date} ${r.fromTime}`;
    if (!confirm(`Cancel this reservation on Sporty Plus?\n\n${when}\n\nThis cannot be undone.`)) return;
    this.message.set(null);
    this.error.set(null);
    this.api.cancelReservation(r.id).subscribe({
      next: () => {
        this.message.set(`Cancelled ${when}.`);
        this.load();
      },
      error: (e) => this.error.set(this.errMsg(e)),
    });
  }

  private errMsg(e: unknown): string {
    const err = e as { error?: { message?: string }; message?: string };
    return err?.error?.message || err?.message || 'Request failed';
  }
}
