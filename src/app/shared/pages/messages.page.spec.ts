import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessagingRepository } from '../../core/api/repositories';
import { SessionStore } from '../../core/auth/session.store';
import { ChatMessage, Conversation } from '../../core/models';
import { ChatEventDto, RealtimeService } from '../../core/realtime/realtime.service';
import { MessagesPage } from './messages.page';

/**
 * Behavioural tests of the whole messaging screen (list + thread + composer) against a fake repository and a fake socket.
 * jsdom has no layout engine, so these tests prove the component/state behaviour (the textarea is never re-created, nothing is duplicated,
 * markup is inert); the CSS height/scroll fix has to be checked in a real browser.
 */
const ME = 'carla';
const day = (d: number, h = 10, m = 0) => new Date(2026, 9, d, h, m).toISOString();
const m = (id: string, sender: string, at: string, text = id): ChatMessage => ({ id, senderId: sender, senderRole: sender === ME ? 'client' : 'photographer', text, at });
const conv = (id: string, photographer: string, messages: ChatMessage[], unreadFor: Record<string, number> = {}): Conversation => ({
  id, customerId: ME, customerName: 'Carla Diaz', photographerId: photographer, photographerName: photographer === 'priya' ? 'Priya Shah' : 'Omar Idrissi',
  photographerAvatar: '', messages, unreadFor, updatedAt: messages.at(-1)?.at ?? day(1),
});

describe('MessagesPage', () => {
  let fixture: ComponentFixture<MessagesPage>;
  let root: HTMLElement;
  let chat$: Subject<ChatEventDto>;
  let rt: { connected: ReturnType<typeof signal<boolean>>; chat$: Subject<ChatEventDto>; reconnected$: Subject<void>; sendMessage: ReturnType<typeof vi.fn>; sendTyping: ReturnType<typeof vi.fn> };
  let repo: { conversations: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; markRead: ReturnType<typeof vi.fn>; older: ReturnType<typeof vi.fn> };

  const settle = async () => { fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges(); await Promise.resolve(); };
  const box = () => root.querySelector('textarea') as HTMLTextAreaElement;
  const bubbles = () => Array.from(root.querySelectorAll('.bubble p')).map(p => p.textContent);
  const typeText = (t: string) => { box().value = t; box().dispatchEvent(new Event('input', { bubbles: true })); };
  const pressEnter = () => box().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  const serverEvent = (e: ChatEventDto) => { chat$.next(e); fixture.detectChanges(); };

  async function create(conversations: Conversation[]) {
    repo.conversations.mockReturnValue(of(conversations));
    fixture = TestBed.createComponent(MessagesPage); root = fixture.nativeElement;
    await settle(); await settle();
  }

  beforeEach(() => {
    chat$ = new Subject<ChatEventDto>();
    rt = { connected: signal(true), chat$, reconnected$: new Subject<void>(), sendMessage: vi.fn(() => true), sendTyping: vi.fn() };
    repo = { conversations: vi.fn(), post: vi.fn(), markRead: vi.fn(() => of(undefined)), older: vi.fn(() => of([])) };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: RealtimeService, useValue: rt }, { provide: MessagingRepository, useValue: repo }] });
    TestBed.inject(SessionStore).set({ token: 't', role: 'client', user: { id: ME, role: 'client', name: 'Carla Diaz', username: ME, email: 'c@x.ma', status: 'active', createdAt: day(1) } });
  });
  afterEach(() => { vi.useRealTimers(); fixture?.destroy(); });

  it('opens the first conversation on desktop with the composer visible', async () => {
    await create([conv('c1', 'priya', [m('1', 'priya', day(29), 'Hi Carla')])]);
    expect(root.querySelector('app-chat-thread')).not.toBeNull();
    expect(box()).not.toBeNull();
    expect(bubbles()).toEqual(['Hi Carla']);
  });

  it('keeps the very same composer element through 50 consecutive messages and shows each exactly once', async () => {
    await create([conv('c1', 'priya', [m('1', 'priya', day(29), 'Hi Carla')])]);
    const original = box();
    for (let i = 1; i <= 50; i++) {
      typeText(`message ${i}`); fixture.detectChanges();
      pressEnter(); fixture.detectChanges();
      expect(box()).toBe(original);            // never re-created
      expect(original.isConnected).toBe(true); // never removed from the page
      expect(original.value).toBe('');         // cleared for the next message
    }
    await settle();
    expect(rt.sendMessage).toHaveBeenCalledTimes(50);
    expect(bubbles().length).toBe(51);
    expect(document.activeElement).toBe(original); // focus stays in the box

    // The server echoes every stored message back (matched by clientMessageId): nothing may be duplicated or left "sending".
    rt.sendMessage.mock.calls.forEach(([conversationId, text, clientMessageId], i) => serverEvent({
      type: 'message', conversationId, unreadFor: { priya: i + 1 },
      message: { id: 'srv-' + i, senderId: ME, senderRole: 'CLIENT', text, at: day(30, 9, i % 60), clientMessageId },
    }));
    await settle();
    expect(bubbles().length).toBe(51);
    expect(root.querySelectorAll('.bubble.pending').length).toBe(0);
    expect(box()).toBe(original);
  });

  it('keeps the draft, caret element and focus when a message arrives from the other person', async () => {
    await create([conv('c1', 'priya', [m('1', 'priya', day(29), 'Hi Carla')])]);
    const original = box(); original.focus(); typeText('half written reply'); fixture.detectChanges();
    serverEvent({ type: 'message', conversationId: 'c1', unreadFor: { carla: 0 }, message: { id: '2', senderId: 'priya', senderRole: 'PHOTOGRAPHER', text: 'Are you there?', at: day(30, 9) } });
    await settle();
    expect(bubbles()).toEqual(['Hi Carla', 'Are you there?']);
    expect(box()).toBe(original); expect(original.value).toBe('half written reply'); expect(document.activeElement).toBe(original);
  });

  it('keeps a separate draft for each conversation', async () => {
    await create([conv('c1', 'priya', [m('1', 'priya', day(30, 12))]), conv('c2', 'omar', [m('2', 'omar', day(30, 9))])]);
    typeText('for Priya'); fixture.detectChanges();
    (root.querySelectorAll('app-conversation-list .row')[1] as HTMLButtonElement).click(); await settle();
    expect(box().value).toBe('');
    typeText('for Omar'); fixture.detectChanges();
    (root.querySelectorAll('app-conversation-list .row')[0] as HTMLButtonElement).click(); await settle();
    expect(box().value).toBe('for Priya');
  });

  it('renders markup in messages as plain text and never creates elements from it', async () => {
    const payloads = ['<script>alert(\'XSS\')</script>', '<img src=x onerror=alert(\'XSS\')>', '<svg onload=alert(\'XSS\')>'];
    await create([conv('c1', 'priya', payloads.map((p, i) => m('x' + i, 'priya', day(30, 9, i), p)))]);
    expect(bubbles()).toEqual(payloads);
    expect(root.querySelectorAll('script, .scroll img, [onerror], [onload]').length).toBe(0);
    // the same payloads typed by me are shown as text too
    typeText(payloads[1]); fixture.detectChanges(); pressEnter(); await settle();
    expect(bubbles().at(-1)).toBe(payloads[1]);
    expect(root.querySelectorAll('.scroll img, [onerror]').length).toBe(0);
    // and the conversation list preview / names are escaped as well
    expect(root.querySelector('app-conversation-list .pv')?.textContent).toContain(payloads[1]); // latest message, shown as text
    expect(root.querySelectorAll('app-conversation-list img:not(.av), app-conversation-list [onerror]').length).toBe(0);
    expect(root.querySelector('app-conversation-list img.av')?.getAttribute('onerror')).toBeNull();
  });

  it('shows date separators, Sent/Read ticks and unread badges', async () => {
    await create([conv('c1', 'priya', [m('1', ME, day(28)), m('2', 'priya', day(29)), m('3', ME, day(30, 9)), m('4', ME, day(30, 9, 1))], { priya: 1, carla: 0 }), conv('c2', 'omar', [m('5', 'omar', day(27))], { carla: 3 })]);
    expect(root.querySelectorAll('.day span').length).toBe(3);
    expect(Array.from(root.querySelectorAll('.line.mine .meta .sr')).map(e => e.textContent)).toEqual(['Read', 'Read', 'Sent']);
    expect(root.querySelector('app-conversation-list .badge')?.textContent?.trim()).toBe('3');
  });

  it('shows "<name> is typing…" with animated dots, and clears it on stop and after a timeout', async () => {
    await create([conv('c1', 'priya', [m('1', 'priya', day(29))])]);
    serverEvent({ type: 'typing', conversationId: 'c1', actor: 'priya' });
    expect(root.querySelector('.sub')?.textContent).toContain('Priya is typing');
    expect(root.querySelectorAll('.typing i').length).toBe(3);
    serverEvent({ type: 'typing_stopped', conversationId: 'c1', actor: 'priya' });
    expect(root.querySelector('.typing')).toBeNull();

    vi.useFakeTimers();
    serverEvent({ type: 'typing', conversationId: 'c1', actor: 'priya' });
    expect(root.querySelector('.typing')).not.toBeNull();
    vi.advanceTimersByTime(4100); fixture.detectChanges(); // the "stopped" signal was lost: it must clear itself
    expect(root.querySelector('.typing')).toBeNull();
  });

  it('tells the other person we are typing, and stops when we send or leave the conversation', async () => {
    await create([conv('c1', 'priya', [m('1', 'priya', day(30, 12))]), conv('c2', 'omar', [m('2', 'omar', day(30, 9))])]);
    typeText('hel'); fixture.detectChanges();
    expect(rt.sendTyping).toHaveBeenCalledWith('c1', true);
    rt.sendTyping.mockClear();
    (root.querySelectorAll('app-conversation-list .row')[1] as HTMLButtonElement).click(); await settle(); // leave c1 without sending
    expect(rt.sendTyping).toHaveBeenCalledWith('c1', false);

    rt.sendTyping.mockClear();
    typeText('hi'); fixture.detectChanges(); pressEnter(); await settle();
    expect(rt.sendTyping).toHaveBeenCalledWith('c2', false); // sending also stops it
  });

  it('falls back to REST when the socket is down and marks a failure with a working Retry', async () => {
    await create([conv('c1', 'priya', [m('1', 'priya', day(29))])]);
    rt.sendMessage.mockReturnValue(false);
    repo.post.mockReturnValueOnce(new Subject<ChatMessage>()); // never answers
    typeText('offline hello'); fixture.detectChanges(); pressEnter(); await settle();
    expect(repo.post).toHaveBeenCalledWith('c1', 'offline hello', expect.any(String));
    expect(root.querySelectorAll('.bubble.pending').length).toBe(1);
  });

  it('does not lose older history when the list is reloaded (e.g. after a reconnect)', async () => {
    const latest = Array.from({ length: 50 }, (_, i) => m('n' + i, 'priya', day(30, 8, i)));
    await create([conv('c1', 'priya', latest)]);
    repo.older.mockReturnValue(of([m('old1', 'priya', day(20)), m('old2', 'priya', day(21))]));
    (root.querySelector('.older') as HTMLButtonElement).click(); await settle();
    expect(bubbles().length).toBe(52);
    expect(repo.older).toHaveBeenCalledWith('c1', latest[0].at, 50);
    expect(root.querySelector('.older')).toBeNull(); // a short page means no more history
    rt.reconnected$.next(); // MessagesPage reloads the list from the server (latest page only)
    await settle();
    expect(bubbles().length).toBe(52);
  });
});