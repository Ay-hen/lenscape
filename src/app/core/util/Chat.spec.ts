import { describe, expect, it } from 'vitest';
import { ChatMessage } from '../models';
import { buildThread, dayLabel, listStamp, mergeMessages, prependOlder } from './chat';

const NOW = new Date(2026, 9, 30, 15, 0, 0); // Fri 30 Oct 2026, local time
const at = (day: number, h: number, m = 0, month = 9) => new Date(2026, month, day, h, m).toISOString();
const msg = (id: string, sender: string, when: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({ id, senderId: sender, senderRole: sender === 'carla' ? 'client' : 'photographer', text: id, at: when, ...extra });

describe('day labels', () => {
  it('names today and yesterday, then weekday, then date', () => {
    expect(dayLabel(at(30, 9), NOW)).toBe('Today');
    expect(dayLabel(at(29, 23), NOW)).toBe('Yesterday');
    expect(dayLabel(at(27, 10), NOW)).toBe('Tuesday');
    expect(dayLabel(at(3, 10), NOW)).toBe('3 October');
    expect(dayLabel(new Date(2025, 11, 24, 10).toISOString(), NOW)).toBe('24 December 2025');
  });
  it('shows the clock time for today in the conversation list', () => {
    expect(listStamp(at(30, 9, 5), NOW)).toBe('09:05');
    expect(listStamp(at(29, 9), NOW)).toBe('Yesterday');
    expect(listStamp(at(3, 9), NOW)).toBe('3 Oct');
  });
});

describe('buildThread', () => {
  it('inserts one separator per day', () => {
    const items = buildThread([msg('a', 'carla', at(29, 10)), msg('b', 'priya', at(29, 11)), msg('c', 'carla', at(30, 9))], 'carla', 0, NOW);
    expect(items.filter(i => i.kind === 'day').map(i => (i.kind === 'day' ? i.label : ''))).toEqual(['Yesterday', 'Today']);
    expect(items.map(i => i.kind)).toEqual(['day', 'msg', 'msg', 'day', 'msg']);
  });

  it('marks my last N confirmed messages as sent and earlier ones as read, from the other side\'s unread count', () => {
    const list = [msg('1', 'carla', at(30, 9)), msg('2', 'priya', at(30, 9, 1)), msg('3', 'carla', at(30, 9, 2)), msg('4', 'carla', at(30, 9, 3))];
    const states = buildThread(list, 'carla', 2, NOW).flatMap(i => (i.kind === 'msg' && i.mine ? [i.state] : []));
    expect(states).toEqual(['read', 'sent', 'sent']);
  });

  it('shows sending and failed states and does not count them against the unread number', () => {
    const list = [msg('1', 'carla', at(30, 9)), msg('2', 'carla', at(30, 9, 1), { status: 'failed' }), msg('3', 'carla', at(30, 9, 2), { status: 'sending' })];
    const states = buildThread(list, 'carla', 1, NOW).flatMap(i => (i.kind === 'msg' ? [i.state] : []));
    expect(states).toEqual(['sent', 'failed', 'sending']);
  });

  it('gives messages from the other person no state', () => {
    const item = buildThread([msg('1', 'priya', at(30, 9))], 'carla', 0, NOW).find(i => i.kind === 'msg');
    expect(item && item.kind === 'msg' && item.state).toBeNull();
  });

  it('groups consecutive messages from one sender within five minutes', () => {
    const items = buildThread([msg('1', 'carla', at(30, 9)), msg('2', 'carla', at(30, 9, 2)), msg('3', 'carla', at(30, 9, 30))], 'carla', 0, NOW).filter(i => i.kind === 'msg');
    expect(items.map(i => (i.kind === 'msg' ? [i.groupStart, i.groupEnd] : []))).toEqual([[true, false], [false, true], [true, true]]);
  });

  it('keeps a stable key when an optimistic message is replaced by the server copy', () => {
    const pending = buildThread([msg('tmp-x', 'carla', at(30, 9), { clientMessageId: 'x', status: 'sending' })], 'carla', 0, NOW).at(-1);
    const saved = buildThread([msg('real-1', 'carla', at(30, 9), { clientMessageId: 'x' })], 'carla', 0, NOW).at(-1);
    expect(pending?.key).toBe(saved?.key);
  });

  it('never interprets message text: markup stays plain text in the data', () => {
    const payload = '<img src=x onerror=alert(1)>';
    const item = buildThread([msg('1', 'priya', at(30, 9), { text: payload })], 'carla', 0, NOW).find(i => i.kind === 'msg');
    expect(item && item.kind === 'msg' && item.message.text).toBe(payload);
  });
});

describe('merging messages', () => {
  it('keeps older history and pending messages when the latest page is reloaded, without duplicates', () => {
    const older = msg('old', 'priya', at(28, 9));
    const server = [msg('s1', 'carla', at(29, 9)), msg('s2', 'priya', at(29, 10))];
    const local = [older, ...server, msg('tmp-p', 'carla', at(30, 9), { clientMessageId: 'p', status: 'sending' })];
    expect(mergeMessages(local, server).map(m => m.id)).toEqual(['old', 's1', 's2', 'tmp-p']);
  });

  it('drops a pending message once the server returns its copy', () => {
    const server = [msg('real', 'carla', at(30, 9), { clientMessageId: 'p' })];
    const local = [msg('tmp-p', 'carla', at(30, 9), { clientMessageId: 'p', status: 'sending' })];
    expect(mergeMessages(local, server).map(m => m.id)).toEqual(['real']);
  });

  it('prepends an older page and skips messages that are already loaded', () => {
    const current = [msg('b', 'carla', at(29, 10)), msg('c', 'carla', at(29, 11))];
    expect(prependOlder(current, [msg('a', 'carla', at(29, 9)), msg('b', 'carla', at(29, 10))]).map(m => m.id)).toEqual(['a', 'b', 'c']);
  });
});