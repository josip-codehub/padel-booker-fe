import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ApiService } from './core/api.service';
import { LoadingService } from './core/loading.service';
import { Health } from './core/models';
import { ConfirmDialog } from './shared/confirm-dialog';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ConfirmDialog],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private api = inject(ApiService);
  private loadingSvc = inject(LoadingService);
  readonly loading = this.loadingSvc.loading;
  health = signal<Health | null>(null);

  ngOnInit(): void {
    this.refreshHealth();
  }

  refreshHealth(): void {
    this.api.health().subscribe({
      next: (h) => this.health.set(h),
      error: () => this.health.set({ configured: false, tokenValid: false, message: 'backend unreachable' }),
    });
  }
}
