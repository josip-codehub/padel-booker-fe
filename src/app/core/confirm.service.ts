import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean; // red confirm button for destructive actions
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

/** In-app replacement for window.confirm(). Returns a Promise<boolean>. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly state = signal<ConfirmState | null>(null);

  ask(opts: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => this.state.set({ ...opts, resolve }));
  }

  respond(value: boolean): void {
    const s = this.state();
    if (s) {
      this.state.set(null);
      s.resolve(value);
    }
  }
}
