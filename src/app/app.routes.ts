import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { Availability } from './pages/availability/availability';
import { History } from './pages/history/history';
import { Login } from './pages/login/login';
import { MyReservations } from './pages/my-reservations/my-reservations';
import { Queue } from './pages/queue/queue';
import { Settings } from './pages/settings/settings';

export const routes: Routes = [
  { path: '', redirectTo: 'availability', pathMatch: 'full' },
  { path: 'login', component: Login, title: 'Sign in' },
  { path: 'availability', component: Availability, title: 'Availability', canActivate: [authGuard] },
  { path: 'my-reservations', component: MyReservations, title: 'My Reservations', canActivate: [authGuard] },
  { path: 'queue', component: Queue, title: 'Queue', canActivate: [authGuard] },
  { path: 'history', component: History, title: 'History', canActivate: [authGuard] },
  { path: 'settings', component: Settings, title: 'Settings', canActivate: [authGuard] },
];
