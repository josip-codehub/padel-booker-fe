import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-change-password-dialog',
  imports: [FormsModule],
  templateUrl: './change-password-dialog.html',
  styleUrl: './change-password-dialog.scss',
})
export class ChangePasswordDialog {
  protected auth = inject(AuthService);

  readonly open = computed(() => this.auth.passwordChangeRequired() || this.auth.voluntaryChangeOpen());
  readonly forced = computed(() => this.auth.passwordChangeRequired());

  currentPassword = signal('');
  newPassword = signal('');
  confirm = signal('');
  error = signal<string | null>(null);
  saving = signal(false);

  private valid(pw: string): boolean {
    return pw.length >= 6 && /[A-Z]/.test(pw);
  }

  submit(): void {
    this.error.set(null);
    const np = this.newPassword();
    if (!this.valid(np)) {
      this.error.set('Password must be at least 6 characters and include an uppercase letter.');
      return;
    }
    if (np !== this.confirm()) {
      this.error.set('Passwords do not match.');
      return;
    }
    this.saving.set(true);
    const current = this.forced() ? null : this.currentPassword();
    this.auth.changePassword(current, np).subscribe({
      next: () => {
        this.saving.set(false);
        this.reset();
        this.auth.onPasswordChanged();
      },
      error: (e) => {
        this.saving.set(false);
        const err = e as { error?: { message?: string } };
        this.error.set(err?.error?.message || 'Could not change password');
      },
    });
  }

  cancel(): void {
    this.reset();
    this.auth.voluntaryChangeOpen.set(false);
  }

  private reset(): void {
    this.currentPassword.set('');
    this.newPassword.set('');
    this.confirm.set('');
    this.error.set(null);
  }
}
