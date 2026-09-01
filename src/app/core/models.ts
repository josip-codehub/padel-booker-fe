export interface SlotPlayer {
  name: string;
  image: string | null;
}

export interface Slot {
  time: number; // decimal-hours x100, e.g. 700, 1450
  timeFmt: string; // "07:00"
  booked: boolean;
  mine: boolean; // booked by me (on Sporty)
  queued: boolean; // future slot already scheduled in the Queue by any app user
  queuedByMe: boolean;
  queuedBy: string | null; // app username who scheduled it
  price: number | null;
  bookedBy: string | null; // who created the reservation
  players: SlotPlayer[]; // participants on a booked slot
}

export type Role = 'USER' | 'ADMIN';

export interface CurrentUser {
  id: number;
  username: string;
  role: Role;
  mustChangePassword: boolean;
  sportyLinked: boolean;
}

export interface ManagedUser {
  id: number;
  username: string;
  role: Role;
  mustChangePassword: boolean;
  sportyLinked: boolean;
  createdAt: string;
}

export interface LoginResponse {
  token: string;
  username: string;
  role: Role;
  mustChangePassword: boolean;
  expiresAt: string;
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

export interface ReserveNowResult {
  success: boolean;
  reservationId: number | null;
  price: number | null;
  message: string;
}

export interface MyReservation {
  id: number;
  courtId: number;
  courtName: string | null;
  date: string;
  fromTime: string | null;
  toTime: string | null;
  players: string[];
  totalPrice: number | null;
  isPaid: boolean;
  needsPayment: boolean;
  createdByMe: boolean;
  recurring: boolean;
}

export interface CreateBookingRequest {
  courtId: number;
  courtName?: string | null;
  playDate: string;
  slotTime: number;
}
