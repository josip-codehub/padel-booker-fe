import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { ManagedUser, Role } from '../../core/models';

@Component({
  selector: 'app-users',
  imports: [FormsModule, DatePipe],
  templateUrl: './users.html',
  styleUrl: './users.scss',
})
export class Users implements OnInit {
  private api = inject(ApiService);
  private confirm = inject(ConfirmService);
  private auth = inject(AuthService);

  users = signal<ManagedUser[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  message = signal<string | null>(null);

  newUsername = signal('');
  newRole = signal<Role>('USER');
  creating = signal(false);

  ngOnInit(): void {
    this.load();
  }

  get myId(): number | undefined {
    return this.auth.currentUser()?.id;
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listUsers().subscribe({
      next: (u) => {
        this.users.set(u);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(this.errMsg(e));
        this.loading.set(false);
      },
    });
  }

  create(): void {
    const name = this.newUsername().trim();
    if (!name) return;
    this.creating.set(true);
    this.message.set(null);
    this.error.set(null);
    this.api.createUser(name, this.newRole()).subscribe({
      next: () => {
        this.creating.set(false);
        this.message.set(`Created "${name}" with temporary password "changeme" — they'll set their own on first login.`);
        this.newUsername.set('');
        this.newRole.set('USER');
        this.load();
      },
      error: (e) => {
        this.creating.set(false);
        this.error.set(this.errMsg(e));
      },
    });
  }

  async resetPassword(u: ManagedUser): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Reset password',
      message: `Reset ${u.username}'s password to "changeme"? They'll be forced to set a new one on next login.`,
      confirmText: 'Reset',
    });
    if (!ok) return;
    this.api.resetUserPassword(u.id).subscribe({
      next: () => {
        this.message.set(`${u.username}'s password reset to "changeme".`);
        this.load();
      },
      error: (e) => this.error.set(this.errMsg(e)),
    });
  }

  async remove(u: ManagedUser): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Delete user',
      message: `Delete ${u.username}? Their Sporty link and any pending scheduled bookings are removed. This can't be undone.`,
      confirmText: 'Delete user',
      cancelText: 'Keep',
      danger: true,
    });
    if (!ok) return;
    this.api.deleteUser(u.id).subscribe({
      next: () => {
        this.message.set(`Deleted ${u.username}.`);
        this.load();
      },
      error: (e) => this.error.set(this.errMsg(e)),
    });
  }

  private errMsg(e: unknown): string {
    const err = e as { error?: { message?: string }; message?: string };
    return err?.error?.message || err?.message || 'Request failed';
  }
}
