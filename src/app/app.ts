import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ApiService } from './core/api.service';
import { Health } from './core/models';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private api = inject(ApiService);
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
