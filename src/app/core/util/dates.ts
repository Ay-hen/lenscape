import { ISODate, TimeOfDay } from '../models';

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function todayISO(): ISODate { return toISODate(new Date()); }
export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISODate(s); d.setDate(d.getDate() + n); return toISODate(d);
}
export function timeToMinutes(t: TimeOfDay): number { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
export function minutesToTime(min: number): TimeOfDay { return `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`; }
export function combine(date: ISODate, time: TimeOfDay): Date { const d = parseISODate(date); d.setMinutes(timeToMinutes(time)); return d; }
export function daysBetween(a: ISODate, b: ISODate): number { return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86400000); }
export function startOfMonth(s: ISODate): ISODate { const d = parseISODate(s); d.setDate(1); return toISODate(d); }
export function monthGrid(month: ISODate, weekStartsOn = 1): ISODate[] {
  const first = parseISODate(startOfMonth(month));
  const offset = (first.getDay() - weekStartsOn + 7) % 7;
  first.setDate(first.getDate() - offset);
  return Array.from({ length: 42 }, (_, i) => { const d = new Date(first); d.setDate(first.getDate() + i); return toISODate(d); });
}
export function startOfWeek(s: ISODate, weekStartsOn = 1): ISODate {
  const d = parseISODate(s); const off = (d.getDay() - weekStartsOn + 7) % 7; d.setDate(d.getDate() - off); return toISODate(d);
}
export function formatDate(s: ISODate, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }): string {
  return new Intl.DateTimeFormat('en-GB', opts).format(parseISODate(s));
}
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(1, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24); if (d < 30) return `${d}d ago`;
  return formatDate(iso.slice(0, 10), { day: 'numeric', month: 'short' });
}
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
