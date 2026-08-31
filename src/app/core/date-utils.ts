/** Date-only helpers that avoid timezone drift by working in UTC on 'yyyy-MM-dd' strings. */

export function todayIso(): string {
  const n = new Date();
  return toIso(new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())));
}

export function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return toIso(dt);
}

export function weekdayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
}

export function dayMonthLabel(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}`;
}

/** Days from today (UTC date math) until the given ISO date. */
export function daysUntil(iso: string): number {
  const t = todayIso();
  const [ty, tm, td] = t.split('-').map(Number);
  const [y, m, d] = iso.split('-').map(Number);
  const a = Date.UTC(ty, tm - 1, td);
  const b = Date.UTC(y, m - 1, d);
  return Math.round((b - a) / 86400000);
}
