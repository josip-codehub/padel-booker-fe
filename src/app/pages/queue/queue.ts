import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../core/api.service';
import { ConfirmService } from '../../core/confirm.service';
import { QueuedBooking } from '../../core/models';

@Component({
  selector: 'app-queue',
  imports: [DatePipe],
  templateUrl: './queue.html',
  styleUrl: './queue.scss',
})
export class Queue implements OnInit {
  private api = inject(ApiService);
  private confirm = inject(ConfirmService);

  bookings = signal<QueuedBooking[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listBookings().subscribe({
      next: (b) => {
        this.bookings.set(b);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(this.errMsg(e));
        this.loading.set(false);
      },
    });
  }

  async cancel(b: QueuedBooking): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Cancel queued booking',
      message: `Cancel queued booking #${b.id}?\n${b.courtName || b.courtId} — ${b.playDate} ${b.slotTimeFmt}`,
      confirmText: 'Cancel booking',
      cancelText: 'Keep',
      danger: true,
    });
    if (!ok) return;
    this.api.cancelBooking(b.id).subscribe({
      next: () => this.load(),
      error: (e) => this.error.set(this.errMsg(e)),
    });
  }

  private errMsg(e: unknown): string {
    const err = e as { error?: { message?: string }; message?: string };
    return err?.error?.message || err?.message || 'Request failed';
  }
}
