import { Injectable, computed, signal } from '@angular/core';

/** Tracks in-flight HTTP requests so the UI can show a blocking overlay. */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private count = signal(0);
  readonly loading = computed(() => this.count() > 0);

  begin(): void {
    this.count.update((c) => c + 1);
  }

  end(): void {
    this.count.update((c) => Math.max(0, c - 1));
  }
}
