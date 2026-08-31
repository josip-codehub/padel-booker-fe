export interface Slot {
  time: number; // HHMM, e.g. 700, 1430
  timeFmt: string; // "07:00"
  booked: boolean;
  price: number | null;
}

export interface CourtDay {
  date: string; // ISO date
  slots: Slot[];
}

export interface CourtWeek {
  courtId: number;
  courtName: string;
  type: string;
  reservationDuration: number;
  days: CourtDay[];
}

export interface Week {
  from: string;
  to: string;
  courts: CourtWeek[];
}

export type BookingStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

export interface QueuedBooking {
  id: number;
  courtId: number;
  courtName: string | null;
  playDate: string;
  slotTime: number;
  slotTimeFmt: string | null;
  price: number | null;
  targetFireAt: string;
  status: BookingStatus;
  createdReservationId: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AttemptOutcome = 'SUCCESS' | 'COURT_UNAVAILABLE' | 'AUTH_FAILED' | 'ERROR';

export interface BookingAttempt {
  id: number;
  bookingId: number;
  attemptNo: number | null;
  attemptAt: string;
  requestBody: string | null;
  httpStatus: number | null;
  responseBody: string | null;
  outcome: AttemptOutcome;
}

export interface Health {
  configured: boolean;
  tokenValid: boolean;
  user?: string | null;
  message?: string | null;
}

export interface SettingsView {
  configured: boolean;
  email: string | null;
  tokenExpiresAt: string | null;
  lastValidatedAt: string | null;
}

export interface CreateBookingRequest {
  courtId: number;
  courtName?: string | null;
  playDate: string;
  slotTime: number;
}
