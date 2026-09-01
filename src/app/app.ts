import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ApiService } from './core/api.service';
import { AuthService } from './core/auth.service';
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
  private auth = inject(AuthService);
  readonly loading = this.loadingSvc.loading;
  readonly authenticated = this.auth.authenticated;
  health = signal<Health | null>(null);

  ngOnInit(): void {
    if (this.authenticated()) this.refreshHealth();
  }

  refreshHealth(): void {
    if (!this.authenticated()) return;
    this.api.health().subscribe({
      next: (h) => this.health.set(h),
      error: () => this.health.set({ configured: false, tokenValid: false, message: 'backend unreachable' }),
    });
  }

  logout(): void {
    this.auth.logout();
  }
}
