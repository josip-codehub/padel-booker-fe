import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../core/api.service';
import { QueuedBooking } from '../../core/models';

@Component({
  selector: 'app-queue',
  imports: [DatePipe],
  templateUrl: './queue.html',
  styleUrl: './queue.scss',
})
export class Queue implements OnInit {
  private api = inject(ApiService);

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

  cancel(b: QueuedBooking): void {
    if (!confirm(`Cancel queued booking #${b.id}?`)) return;
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
