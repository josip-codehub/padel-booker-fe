import { Routes } from '@angular/router';
import { Availability } from './pages/availability/availability';
import { Queue } from './pages/queue/queue';
import { History } from './pages/history/history';
import { Settings } from './pages/settings/settings';

export const routes: Routes = [
  { path: '', redirectTo: 'availability', pathMatch: 'full' },
  { path: 'availability', component: Availability, title: 'Availability' },
  { path: 'queue', component: Queue, title: 'Queue' },
  { path: 'history', component: History, title: 'History' },
  { path: 'settings', component: Settings, title: 'Settings' },
];
