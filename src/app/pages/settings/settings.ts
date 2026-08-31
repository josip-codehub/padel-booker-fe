import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { SettingsView } from '../../core/models';

@Component({
  selector: 'app-settings',
  imports: [FormsModule, DatePipe],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings implements OnInit {
  private api = inject(ApiService);

  current = signal<SettingsView | null>(null);
  email = signal('');
  password = signal('');
  token = signal('');
  saving = signal(false);
  message = signal<string | null>(null);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.getSettings().subscribe({
      next: (s) => {
        this.current.set(s);
        this.email.set(s.email ?? '');
      },
      error: (e) => this.error.set(this.errMsg(e)),
    });
  }

  save(): void {
    this.saving.set(true);
    this.message.set(null);
    this.error.set(null);
    this.api
      .saveSettings({
        email: this.email() || undefined,
        password: this.password() || undefined,
        token: this.token() || undefined,
      })
      .subscribe({
        next: (r) => {
          this.saving.set(false);
          this.message.set(r.message);
          this.password.set('');
          this.token.set('');
          this.load();
        },
        error: (e) => {
          this.saving.set(false);
          this.error.set(this.errMsg(e));
        },
      });
  }

  private errMsg(e: unknown): string {
    const err = e as { error?: { message?: string }; message?: string };
    return err?.error?.message || err?.message || 'Request failed';
  }
}
