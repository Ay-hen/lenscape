import { AppNotification, NotificationType } from '../../core/models';

/** Icon + colour family for each notification type. The colours come from the design tokens, so they follow light/dark mode. */
export interface NoteMeta { icon: string; label: string; tone: 'blue' | 'teal' | 'amber' | 'slate' | 'green' }
export const NOTE_META: Record<NotificationType, NoteMeta> = {
  booking: { icon: 'calendar-check', label: 'Bookings', tone: 'blue' },
  message: { icon: 'message', label: 'Messages', tone: 'teal' },
  review: { icon: 'star', label: 'Reviews', tone: 'amber' },
  system: { icon: 'info', label: 'System', tone: 'slate' },
  approval: { icon: 'user-check', label: 'Account', tone: 'green' },
};
export const metaOf = (t: string): NoteMeta => NOTE_META[t as NotificationType] ?? NOTE_META.system;

export interface NoteGroup { label: string; items: AppNotification[] }

/** Groups (already newest-first) notifications under Today / Yesterday / This week / Earlier. */
export function groupByDay(list: AppNotification[], now = new Date()): NoteGroup[] {
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = start(now); const day = 86_400_000;
  const buckets: NoteGroup[] = [{ label: 'Today', items: [] }, { label: 'Yesterday', items: [] }, { label: 'This week', items: [] }, { label: 'Earlier', items: [] }];
  for (const n of list) {
    const t = start(new Date(n.createdAt)); const age = today - t;
    (age < day ? buckets[0] : age < 2 * day ? buckets[1] : age < 7 * day ? buckets[2] : buckets[3]).items.push(n);
  }
  return buckets.filter(b => b.items.length);
}
