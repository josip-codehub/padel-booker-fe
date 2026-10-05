import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AvailabilityPrefs,
  BookingAttempt,
  ClubForecast,
  ClubView,
  CourtPrefs,
  CreateBookingRequest,
  FixedBookingView,
  Health,
  ManagedUser,
  MyReservation,
  PlayerSearchResult,
  QueuedBooking,
  ReservationPlayer,
  ReserveNowResult,
  Role,
  SettingsView,
  Week,
} from './models';

const BASE = '/api';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  health(): Observable<Health> {
    return this.http.get<Health>(`${BASE}/health`);
  }

  // --- clubs ---
  clubs(): Observable<ClubView[]> {
    return this.http.get<ClubView[]>(`${BASE}/clubs`);
  }

  refreshClubs(): Observable<ClubView[]> {
    return this.http.post<ClubView[]>(`${BASE}/clubs/refresh`, {});
  }

  /** Raw courts for a club (id + name used by the Settings court filter). */
  courts(clubId: number): Observable<{ data?: { id: number; name: string }[] } | { id: number; name: string }[]> {
    return this.http.get<{ data?: { id: number; name: string }[] }>(`${BASE}/courts`, {
      params: { club: String(clubId) },
    });
  }

  availability(clubs: number[], courts: number[], from: string, to: string): Observable<Week> {
    let params: Record<string, string | string[]> = { from, to };
    if (clubs.length) params['clubs'] = clubs.map(String);
    if (courts.length) params['courts'] = courts.map(String);
    return this.http.get<Week>(`${BASE}/availability`, { params });
  }

  listBookings(): Observable<QueuedBooking[]> {
    return this.http.get<QueuedBooking[]>(`${BASE}/bookings`);
  }

  createBooking(req: CreateBookingRequest): Observable<QueuedBooking> {
    return this.http.post<QueuedBooking>(`${BASE}/bookings`, req);
  }

  reserveNow(req: CreateBookingRequest): Observable<ReserveNowResult> {
    return this.http.post<ReserveNowResult>(`${BASE}/bookings/now`, req);
  }

  cancelBooking(id: number): Observable<QueuedBooking> {
    return this.http.delete<QueuedBooking>(`${BASE}/bookings/${id}`);
  }

  bookingAttempts(id: number): Observable<BookingAttempt[]> {
    return this.http.get<BookingAttempt[]>(`${BASE}/bookings/${id}/attempts`);
  }

  recentAttempts(): Observable<BookingAttempt[]> {
    return this.http.get<BookingAttempt[]>(`${BASE}/attempts`);
  }

  myReservations(from?: string): Observable<MyReservation[]> {
    const params: Record<string, string> = from ? { from } : {};
    return this.http.get<MyReservation[]>(`${BASE}/my-reservations`, { params });
  }

  cancelReservation(id: number, clubId?: number): Observable<unknown> {
    const params: Record<string, string> = clubId ? { club: String(clubId) } : {};
    return this.http.delete(`${BASE}/my-reservations/${id}`, { params });
  }

  // --- players ---
  searchPlayers(club: number, q: string): Observable<PlayerSearchResult[]> {
    return this.http.get<PlayerSearchResult[]>(`${BASE}/players/search`, { params: { club: String(club), q } });
  }

  reservationPlayers(id: number, club: number, court: number, date: string): Observable<ReservationPlayer[]> {
    return this.http.get<ReservationPlayer[]>(`${BASE}/my-reservations/${id}/players`, {
      params: { club: String(club), court: String(court), date },
    });
  }

  addReservationPlayers(
    id: number,
    body: { club: number; court: number; date: string; playerIds: number[] },
  ): Observable<ReservationPlayer[]> {
    return this.http.post<ReservationPlayer[]>(`${BASE}/my-reservations/${id}/players`, body);
  }

  removeReservationPlayer(
    id: number,
    playerId: number,
    club: number,
    court: number,
    date: string,
  ): Observable<ReservationPlayer[]> {
    return this.http.delete<ReservationPlayer[]>(`${BASE}/my-reservations/${id}/players/${playerId}`, {
      params: { club: String(club), court: String(court), date },
    });
  }

  // --- weather (cached server-side for the day; refresh is throttled) ---
  weather(clubs: number[]): Observable<ClubForecast[]> {
    return this.http.get<ClubForecast[]>(`${BASE}/weather`, { params: { clubs: clubs.map(String) } });
  }

  refreshWeather(clubs: number[]): Observable<ClubForecast[]> {
    return this.http.post<ClubForecast[]>(`${BASE}/weather/refresh`, {}, { params: { clubs: clubs.map(String) } });
  }

  // --- preferences ---
  getCourtPrefs(): Observable<CourtPrefs> {
    return this.http.get<CourtPrefs>(`${BASE}/account/court-prefs`);
  }

  putCourtPrefs(prefs: CourtPrefs): Observable<CourtPrefs> {
    return this.http.put<CourtPrefs>(`${BASE}/account/court-prefs`, prefs);
  }

  getAvailabilityPrefs(): Observable<AvailabilityPrefs> {
    return this.http.get<AvailabilityPrefs>(`${BASE}/account/availability-prefs`);
  }

  putAvailabilityPrefs(prefs: AvailabilityPrefs): Observable<AvailabilityPrefs> {
    return this.http.put<AvailabilityPrefs>(`${BASE}/account/availability-prefs`, prefs);
  }

  // --- admin: fixed (weekly) bookings ---
  listFixedBookings(): Observable<FixedBookingView[]> {
    return this.http.get<FixedBookingView[]>(`${BASE}/admin/fixed-bookings`);
  }

  cancelFixedBooking(id: number): Observable<unknown> {
    return this.http.delete(`${BASE}/admin/fixed-bookings/${id}`);
  }

  // --- admin user management ---
  listUsers(): Observable<ManagedUser[]> {
    return this.http.get<ManagedUser[]>(`${BASE}/admin/users`);
  }

  createUser(username: string, role: Role): Observable<ManagedUser> {
    return this.http.post<ManagedUser>(`${BASE}/admin/users`, { username, role });
  }

  deleteUser(id: number): Observable<unknown> {
    return this.http.delete(`${BASE}/admin/users/${id}`);
  }

  resetUserPassword(id: number): Observable<{ temporaryPassword: string }> {
    return this.http.post<{ temporaryPassword: string }>(`${BASE}/admin/users/${id}/reset-password`, {});
  }

  getSettings(): Observable<SettingsView> {
    return this.http.get<SettingsView>(`${BASE}/settings`);
  }

  saveSettings(body: { email?: string; password?: string; token?: string }): Observable<{
    configured: boolean;
    loginOk: boolean;
    message: string;
  }> {
    return this.http.post<{ configured: boolean; loginOk: boolean; message: string }>(
      `${BASE}/settings`,
      body,
    );
  }
}
