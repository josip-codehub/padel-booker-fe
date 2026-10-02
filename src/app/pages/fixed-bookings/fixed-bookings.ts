import { Component, OnInit, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { ConfirmService } from '../../core/confirm.service';
import { FixedBookingView } from '../../core/models';

@Component({
  selector: 'app-fixed-bookings',
  imports: [],
  templateUrl: './fixed-bookings.html',
  styleUrl: './fixed-bookings.scss',
})
export class FixedBookings implements OnInit {
  private api = inject(ApiService);
  private confirm = inject(ConfirmService);

  rules = signal<FixedBookingView[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  message = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listFixedBookings().subscribe({
      next: (r) => {
        this.rules.set(r);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(this.errMsg(e));
        this.loading.set(false);
      },
    });
  }

  async cancel(r: FixedBookingView): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Cancel fixed booking',
      message: `Stop the standing weekly booking on ${r.weekdayName} ${r.slotTimeFmt}–${r.slotEndFmt} at ${r.clubName} · ${r.courtName}?\n\nFuture weeks stop and the next pending one is dropped. Already-booked courts stay (cancel those individually).`,
      confirmText: 'Stop weekly booking',
      cancelText: 'Keep',
      danger: true,
    });
    if (!ok) return;
    this.api.cancelFixedBooking(r.id).subscribe({
      next: () => {
        this.message.set(`Stopped the weekly booking on ${r.weekdayName} ${r.slotTimeFmt}.`);
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
