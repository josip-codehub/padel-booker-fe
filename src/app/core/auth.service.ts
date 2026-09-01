import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { CurrentUser, LoginResponse } from './models';

const TOKEN_KEY = 'appToken';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private _token = signal<string | null>(this.read());
  readonly currentUser = signal<CurrentUser | null>(null);

  readonly authenticated = computed(() => !!this._token());
  readonly isAdmin = computed(() => this.currentUser()?.role === 'ADMIN');

  /** Drives the forced (blocking) password-change modal. */
  readonly passwordChangeRequired = signal(false);
  /** Drives the voluntary (self-initiated) password-change modal. */
  readonly voluntaryChangeOpen = signal(false);

  token(): string | null {
    return this._token();
  }

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>('/api/app-login', { username, password });
  }

  setToken(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* ignore */
    }
    this._token.set(token);
  }

  /** Load the current user's profile (role, mustChangePassword, sportyLinked). */
  loadAccount(): Observable<CurrentUser> {
    return this.http.get<CurrentUser>('/api/account').pipe(
      tap((u) => {
        this.currentUser.set(u);
        this.passwordChangeRequired.set(u.mustChangePassword);
      }),
    );
  }

  changePassword(currentPassword: string | null, newPassword: string): Observable<unknown> {
    return this.http.post('/api/account/password', { currentPassword, newPassword });
  }

  /** Called by the interceptor when the API says a password change is required. */
  requirePasswordChange(): void {
    this.passwordChangeRequired.set(true);
  }

  openVoluntaryChange(): void {
    this.voluntaryChangeOpen.set(true);
  }

  onPasswordChanged(): void {
    this.passwordChangeRequired.set(false);
    this.voluntaryChangeOpen.set(false);
    this.loadAccount().subscribe({ next: () => {}, error: () => {} });
  }

  logout(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
    this._token.set(null);
    this.currentUser.set(null);
    this.passwordChangeRequired.set(false);
    this.voluntaryChangeOpen.set(false);
    this.router.navigateByUrl('/login');
  }

  private read(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }
}
