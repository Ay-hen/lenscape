import { ChatMessage } from '../models';

/**
 * Pure helpers for the messaging screens. They hold no state and touch no DOM, so they are covered by unit tests (chat.spec.ts).
 * Everything user-controlled (message text, names) is passed through untouched: escaping is done by Angular's template interpolation, never here.
 */

const pad = (n: number) => String(n).padStart(2, '0');
const GROUP_GAP_MS = 5 * 60_000;

export type MessageState = 'sending' | 'failed' | 'sent' | 'read';

export type ThreadItem =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'msg'; key: string; message: ChatMessage; mine: boolean; state: MessageState | null; groupStart: boolean; groupEnd: boolean; time: string };

/** Local calendar day of a timestamp, e.g. "2026-10-30". */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const shiftDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const daysAgo = (iso: string, now: Date) => Math.round((new Date(dayKey(now.toISOString())).getTime() - new Date(dayKey(iso)).getTime()) / 86_400_000);

/** "Today", "Yesterday", a weekday for the last week, otherwise a date. */
export function dayLabel(iso: string, now = new Date()): string {
  const key = dayKey(iso);
  if (key === dayKey(now.toISOString())) return 'Today';
  if (key === dayKey(shiftDays(now, -1).toISOString())) return 'Yesterday';
  const d = new Date(iso);
  if (daysAgo(iso, now) < 7 && daysAgo(iso, now) > 0) return new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(d);
  const sameYear = d.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat('en-GB', sameYear ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

/** "14:05" */
export function clockTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

/** Compact stamp for the conversation list: time today, "Yesterday", weekday this week, otherwise "3 Oct". */
export function listStamp(iso: string, now = new Date()): string {
  const key = dayKey(iso);
  if (key === dayKey(now.toISOString())) return clockTime(iso);
  if (key === dayKey(shiftDays(now, -1).toISOString())) return 'Yesterday';
  const ago = daysAgo(iso, now);
  if (ago > 0 && ago < 7) return new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(new Date(iso));
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(iso));
}

const when = (iso: string) => new Date(iso).getTime();

/**
 * Turns an ascending message list into render items: day separators, sender grouping and delivery state.
 *
 * Delivery state of my own messages needs no extra server data: the server counts, per participant, how many messages
 * they have not read yet ({@code unreadFor}). So the last `otherUnread` of my confirmed messages are "sent" and every
 * earlier one is "read". Messages still travelling are "sending", messages that failed are "failed".
 * ("Delivered" is not offered because the server does not track it.)
 */
export function buildThread(messages: ChatMessage[], meId: string | undefined, otherUnread: number, now = new Date()): ThreadItem[] {
  const states = new Map<ChatMessage, MessageState>();
  let remainingUnread = Math.max(0, otherUnread);
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.senderId !== meId) continue;
    if (m.status === 'sending' || m.status === 'failed') { states.set(m, m.status); continue; }
    if (remainingUnread > 0) { states.set(m, 'sent'); remainingUnread--; } else states.set(m, 'read');
  }

  const items: ThreadItem[] = [];
  let lastDay = '';
  messages.forEach((m, i) => {
    const day = dayKey(m.at);
    if (day !== lastDay) { items.push({ kind: 'day', key: 'day:' + day, label: dayLabel(m.at, now) }); lastDay = day; }
    const prev = messages[i - 1]; const next = messages[i + 1];
    const joins = (a?: ChatMessage, b?: ChatMessage) => !!a && !!b && a.senderId === b.senderId && dayKey(a.at) === dayKey(b.at) && Math.abs(when(b.at) - when(a.at)) < GROUP_GAP_MS;
    items.push({
      kind: 'msg', key: 'msg:' + (m.clientMessageId || m.id), message: m, mine: m.senderId === meId, state: states.get(m) ?? null,
      groupStart: !joins(prev, m), groupEnd: !joins(m, next), time: clockTime(m.at),
    });
  });
  return items;
}

const sameMessage = (a: ChatMessage, b: ChatMessage) => a.id === b.id || (!!a.clientMessageId && a.clientMessageId === b.clientMessageId);

/**
 * Combines a freshly loaded latest page from the server with what is already on screen, without losing anything and without duplicates:
 * older history that was loaded earlier stays, and messages that are still sending (or failed) stay at the end.
 */
export function mergeMessages(local: ChatMessage[], server: ChatMessage[]): ChatMessage[] {
  const firstServer = server.length ? when(server[0].at) : null;
  const extra = local.filter(m => !server.some(s => sameMessage(s, m)) && (!!m.status || (firstServer !== null && when(m.at) < firstServer)));
  return [...extra.filter(m => !m.status), ...server, ...extra.filter(m => !!m.status)];
}

/** Adds an older page in front of the loaded messages, skipping any message that is already present. */
export function prependOlder(current: ChatMessage[], older: ChatMessage[]): ChatMessage[] {
  return [...older.filter(o => !current.some(c => sameMessage(c, o))), ...current];
}