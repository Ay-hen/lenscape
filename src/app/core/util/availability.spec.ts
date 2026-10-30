import { AvailabilityRules } from '../models';
import { addDays, todayISO } from './dates';
import { computeSlots, hasAnySlot, isBlocked, rangesForDate } from './availability';

function rules(over: Partial<AvailabilityRules> = {}): AvailabilityRules {
  const on = { enabled: true, ranges: [{ start: '09:00', end: '13:00' }] };
  return { photographerId: 'p', weekly: Array.from({ length: 7 }, () => structuredClone(on)), slotStepMinutes: 60, bufferBeforeMinutes: 0, bufferAfterMinutes: 0, minNoticeHours: 0, maxAdvanceDays: 90, blockedDates: [], exceptions: [], ...over };
}
const day = addDays(todayISO(), 10);

describe('availability engine', () => {
  it('generates slots that fit the duration inside the working range', () => {
    const s = computeSlots(rules(), day, 120, []);
    expect(s.map(x => x.start)).toEqual(['09:00', '10:00', '11:00']);
    expect(s.every(x => x.available)).toBe(true);
  });
  it('offers nothing when the session is longer than every range', () => {
    expect(computeSlots(rules(), day, 300, [])).toEqual([]);
  });
  it('marks slots overlapping an existing booking (plus buffers) as booked', () => {
    const s = computeSlots(rules({ bufferAfterMinutes: 30 }), day, 60, [{ date: day, startTime: '10:00', endTime: '11:00' }]);
    const by = Object.fromEntries(s.map(x => [x.start, x]));
    expect(by['09:00'].available).toBe(true);
    expect(by['10:00'].reason).toBe('booked');
    expect(by['11:00'].reason).toBe('booked'); // 30 min buffer after the booking
    expect(hasAnySlot(rules(), day, 60, [])).toBe(true);
  });
  it('respects blocked dates and exceptions', () => {
    const r = rules({ blockedDates: [{ id: 'b', start: day, end: day, reason: 'x' }] });
    expect(isBlocked(r, day)).toBe(true);
    expect(computeSlots(r, day, 60, [])).toEqual([]);
    const ex = rules({ exceptions: [{ date: day, ranges: [{ start: '15:00', end: '17:00' }] }] });
    expect(rangesForDate(ex, day)).toEqual([{ start: '15:00', end: '17:00' }]);
    expect(computeSlots(ex, day, 60, []).map(x => x.start)).toEqual(['15:00', '16:00']);
  });
  it('does not offer past times or dates beyond the booking horizon', () => {
    expect(computeSlots(rules(), addDays(todayISO(), -2), 60, []).every(x => !x.available)).toBe(true);
    expect(computeSlots(rules({ maxAdvanceDays: 5 }), day, 60, []).every(x => !x.available)).toBe(true);
  });
  it('enforces minimum notice', () => {
    const tomorrow = addDays(todayISO(), 1);
    expect(computeSlots(rules({ minNoticeHours: 24 * 3 }), tomorrow, 60, []).every(x => !x.available)).toBe(true);
  });
});
