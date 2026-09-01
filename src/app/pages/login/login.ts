import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private auth = inject(AuthService);
  private router = inject(Router);

  username = signal('');
  password = signal('');
  error = signal<string | null>(null);
  submitting = signal(false);

  submit(): void {
    this.error.set(null);
    this.submitting.set(true);
    this.auth.login(this.username(), this.password()).subscribe({
      next: (res) => {
        this.auth.setToken(res.token);
        this.submitting.set(false);
        this.router.navigateByUrl('/availability');
      },
      error: (e) => {
        this.submitting.set(false);
        const err = e as { error?: { message?: string }; status?: number };
        this.error.set(err?.error?.message || 'Login failed');
      },
    });
  }
}
