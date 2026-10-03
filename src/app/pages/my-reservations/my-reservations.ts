import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { ConfirmService } from '../../core/confirm.service';
import { MyReservation, PlayerSearchResult, ReservationPlayer } from '../../core/models';
import { todayIso, weekdayLabel } from '../../core/date-utils';
import { PlayerSearch } from '../../shared/player-search';

@Component({
  selector: 'app-my-reservations',
  imports: [FormsModule, PlayerSearch],
  templateUrl: './my-reservations.html',
  styleUrl: './my-reservations.scss',
})
export class MyReservations implements OnInit {
  private api = inject(ApiService);
  private confirm = inject(ConfirmService);

  from = signal<string>(todayIso());
  reservations = signal<MyReservation[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  message = signal<string | null>(null);
  private clubNames = signal<Record<number, string>>({});

  ngOnInit(): void {
    this.api.clubs().subscribe({
      next: (clubs) => {
        const map: Record<number, string> = {};
        for (const c of clubs) map[c.clubId] = c.name;
        this.clubNames.set(map);
      },
      error: () => {},
    });
    this.load();
  }

  clubName(id: number | null): string {
    if (id == null) return '—';
    return this.clubNames()[id] ?? `Club ${id}`;
  }

  // --- manage players ---
  managing = signal<MyReservation | null>(null);
  managePlayers = signal<ReservationPlayer[]>([]);
  manageBusy = signal(false);
  manageError = signal<string | null>(null);

  openManage(r: MyReservation): void {
    this.managing.set(r);
    this.managePlayers.set([]);
    this.manageError.set(null);
    this.manageBusy.set(true);
    this.api.reservationPlayers(r.id, r.clubId, r.courtId, r.date).subscribe({
      next: (p) => {
        this.managePlayers.set(p);
        this.manageBusy.set(false);
      },
      error: (e) => {
        this.manageError.set(this.errMsg(e));
        this.manageBusy.set(false);
      },
    });
  }

  closeManage(): void {
    this.managing.set(null);
  }

  addManagePlayer(p: PlayerSearchResult): void {
    const r = this.managing();
    if (!r) return;
    if (this.managePlayers().some((x) => x.playerId === p.playerId)) return;
    this.manageBusy.set(true);
    this.manageError.set(null);
    this.api
      .addReservationPlayers(r.id, { club: r.clubId, court: r.courtId, date: r.date, playerIds: [p.playerId] })
      .subscribe({
        next: (players) => {
          this.managePlayers.set(players);
          this.manageBusy.set(false);
          this.load(); // refresh the table's player names
        },
        error: (e) => {
          this.manageError.set(this.errMsg(e));
          this.manageBusy.set(false);
        },
      });
  }

  removeManagePlayer(playerId: number): void {
    const r = this.managing();
    if (!r) return;
    this.manageBusy.set(true);
    this.manageError.set(null);
    this.api.removeReservationPlayer(r.id, playerId, r.clubId, r.courtId, r.date).subscribe({
      next: (players) => {
        this.managePlayers.set(players);
        this.manageBusy.set(false);
        this.load();
      },
      error: (e) => {
        this.manageError.set(this.errMsg(e));
        this.manageBusy.set(false);
      },
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.myReservations(this.from()).subscribe({
      next: (r) => {
        this.reservations.set(r);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(this.errMsg(e));
        this.loading.set(false);
      },
    });
  }

  onFromChange(value: string): void {
    if (value) {
      this.from.set(value);
      this.load();
    }
  }

  weekday(date: string): string {
    return weekdayLabel(date);
  }

  async cancel(r: MyReservation): Promise<void> {
    const when = `${r.courtName} — ${r.date} ${r.fromTime}`;
    const ok = await this.confirm.ask({
      title: 'Cancel reservation',
      message: `Cancel this reservation on Sporty Plus?\n\n${when}\n\nThis cannot be undone.`,
      confirmText: 'Cancel reservation',
      cancelText: 'Keep',
      danger: true,
    });
    if (!ok) return;
    this.message.set(null);
    this.error.set(null);
    this.api.cancelReservation(r.id, r.clubId).subscribe({
      next: () => {
        this.message.set(`Cancelled ${when}.`);
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
