import { AvailabilityRules, ISODate, Slot, TimeOfDay, TimeRange } from '../models';
import { addDays, combine, daysBetween, minutesToTime, parseISODate, timeToMinutes, todayISO } from './dates';

export interface BusyInterval { date: ISODate; startTime: TimeOfDay; endTime: TimeOfDay }

/** Pure, reusable availability logic. The real backend MUST re-run equivalent validation on booking creation. */
export function rangesForDate(rules: AvailabilityRules, date: ISODate): TimeRange[] {
  if (rules.blockedDates.some(b => date >= b.start && date <= b.end)) return [];
  const ex = rules.exceptions.find(e => e.date === date);
  if (ex) return ex.ranges;
  const day = rules.weekly[parseISODate(date).getDay()];
  return day?.enabled ? day.ranges : [];
}

export function isBlocked(rules: AvailabilityRules, date: ISODate): boolean {
  return rules.blockedDates.some(b => date >= b.start && date <= b.end);
}

export function computeSlots(
  rules: AvailabilityRules,
  date: ISODate,
  durationMinutes: number,
  busy: BusyInterval[],
  now: Date = new Date(),
): Slot[] {
  const slots: Slot[] = [];
  const blocked = isBlocked(rules, date);
  const beyond = daysBetween(todayISO(), date) > rules.maxAdvanceDays;
  const ranges = rangesForDate(rules, date);
  const dayBusy = busy.filter(b => b.date === date).map(b => ({
    s: timeToMinutes(b.startTime) - rules.bufferBeforeMinutes,
    e: timeToMinutes(b.endTime) + rules.bufferAfterMinutes,
  }));
  const earliest = now.getTime() + rules.minNoticeHours * 3600_000;

  const source = blocked ? [] : ranges;
  for (const r of source) {
    const rs = timeToMinutes(r.start), re = timeToMinutes(r.end);
    for (let s = rs; s + durationMinutes <= re; s += rules.slotStepMinutes) {
      const e = s + durationMinutes;
      const start = minutesToTime(s), end = minutesToTime(e);
      let reason: Slot['reason'];
      if (beyond) reason = 'notice';
      else if (combine(date, start).getTime() < now.getTime()) reason = 'past';
      else if (combine(date, start).getTime() < earliest) reason = 'notice';
      else if (dayBusy.some(b => s < b.e && e > b.s)) reason = 'booked';
      slots.push({ start, end, available: !reason, reason });
    }
  }
  return slots;
}

export function hasAnySlot(rules: AvailabilityRules, date: ISODate, durationMinutes: number, busy: BusyInterval[]): boolean {
  return computeSlots(rules, date, durationMinutes, busy).some(s => s.available);
}

export function nextAvailableDate(rules: AvailabilityRules, durationMinutes: number, busy: BusyInterval[], from = todayISO()): ISODate | undefined {
  for (let i = 0; i <= Math.min(rules.maxAdvanceDays, 90); i++) {
    const d = addDays(from, i);
    if (hasAnySlot(rules, d, durationMinutes, busy)) return d;
  }
  return undefined;
}
