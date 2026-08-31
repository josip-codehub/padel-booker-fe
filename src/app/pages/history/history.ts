import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../core/api.service';
import { BookingAttempt } from '../../core/models';

@Component({
  selector: 'app-history',
  imports: [DatePipe],
  templateUrl: './history.html',
  styleUrl: './history.scss',
})
export class History implements OnInit {
  private api = inject(ApiService);

  attempts = signal<BookingAttempt[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.recentAttempts().subscribe({
      next: (a) => {
        this.attempts.set(a);
        this.loading.set(false);
      },
      error: (e) => {
        const err = e as { error?: { message?: string }; message?: string };
        this.error.set(err?.error?.message || err?.message || 'Request failed');
        this.loading.set(false);
      },
    });
  }

  snippet(body: string | null): string {
    if (!body) return '';
    return body.length > 160 ? body.slice(0, 160) + '…' : body;
  }
}
