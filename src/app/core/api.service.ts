import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  BookingAttempt,
  CreateBookingRequest,
  Health,
  MyReservation,
  QueuedBooking,
  ReserveNowResult,
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

  availability(from: string, to: string): Observable<Week> {
    return this.http.get<Week>(`${BASE}/availability`, { params: { from, to } });
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

  cancelReservation(id: number): Observable<unknown> {
    return this.http.delete(`${BASE}/my-reservations/${id}`);
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
