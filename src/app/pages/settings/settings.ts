import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { ClubView, SettingsView } from '../../core/models';

interface CourtOpt {
  id: number;
  name: string;
}

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

  // Clubs & courts
  clubs = signal<ClubView[]>([]);
  courtsByClub = signal<Record<number, CourtOpt[]>>({});
  hidden = signal<Record<string, number[]>>({});
  indoor = signal<Record<string, number[]>>({});
  clubsMsg = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
    this.loadClubsAndCourts();
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

  private loadClubsAndCourts(): void {
    this.api.getCourtPrefs().subscribe({
      next: (cp) => {
        this.hidden.set(cp?.hidden ?? {});
        this.indoor.set(cp?.indoor ?? {});
      },
      error: () => {},
    });
    this.api.clubs().subscribe({
      next: (clubs) => {
        this.clubs.set(clubs);
        for (const c of clubs) this.fetchCourts(c.clubId);
      },
      error: () => {},
    });
  }

  private fetchCourts(clubId: number): void {
    this.api.courts(clubId).subscribe({
      next: (resp) => {
        const arr = Array.isArray(resp) ? resp : (resp?.data ?? []);
        const opts = arr.map((c) => ({ id: c.id, name: c.name }));
        this.courtsByClub.set({ ...this.courtsByClub(), [clubId]: opts });
      },
      error: () => {},
    });
  }

  courtsFor(clubId: number): CourtOpt[] {
    return this.courtsByClub()[clubId] ?? [];
  }

  isVisible(clubId: number, courtId: number): boolean {
    return !(this.hidden()[String(clubId)] ?? []).includes(courtId);
  }

  toggleVisible(clubId: number, courtId: number): void {
    this.hidden.set(this.toggled(this.hidden(), clubId, courtId));
    this.saveCourtPrefs('Court visibility saved.');
  }

  isIndoor(clubId: number, courtId: number): boolean {
    return (this.indoor()[String(clubId)] ?? []).includes(courtId);
  }

  /** Indoor courts get no weather row on the Availability screen. */
  toggleIndoor(clubId: number, courtId: number): void {
    this.indoor.set(this.toggled(this.indoor(), clubId, courtId));
    this.saveCourtPrefs('Indoor setting saved.');
  }

  private toggled(map: Record<string, number[]>, clubId: number, courtId: number): Record<string, number[]> {
    const key = String(clubId);
    const current = new Set(map[key] ?? []);
    if (current.has(courtId)) current.delete(courtId);
    else current.add(courtId);
    return { ...map, [key]: [...current] };
  }

  private saveCourtPrefs(msg: string): void {
    this.api.putCourtPrefs({ hidden: this.hidden(), indoor: this.indoor() }).subscribe({
      next: () => this.clubsMsg.set(msg),
      error: (e) => this.error.set(this.errMsg(e)),
    });
  }

  refreshClubs(): void {
    this.clubsMsg.set(null);
    this.api.refreshClubs().subscribe({
      next: (clubs) => {
        this.clubs.set(clubs);
        for (const c of clubs) this.fetchCourts(c.clubId);
        this.clubsMsg.set('Clubs refreshed from Sporty.');
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
