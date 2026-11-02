import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MessagingRepository } from '../../core/api/repositories';
import { SessionStore } from '../../core/auth/session.store';
import { ChatEventDto, RealtimeService } from '../../core/realtime/realtime.service';
import { ChatMessage, Conversation, Role } from '../../core/models';
import { mergeMessages, prependOlder } from '../../core/util/chat';
import { errorText } from '../../core/util/forms';
import { avatarImage } from '../../core/util/images';
import { EmptyStateComponent, ErrorStateComponent, PageHeaderComponent } from '../ui/misc';
import { IconComponent } from '../ui/icon.component';
import { ConfirmService, ToastService } from '../services/overlay.services';
import { SeoService } from '../../core/seo.service';
import { ConversationListComponent } from './chat/conversation-list.component';
import { ChatThreadComponent } from './chat/chat-thread.component';

/** Messages the server returns per page (ChatService.PAGE). A full first page means older history may exist. */
const PAGE = 50;

/**
 * Booking conversations for customers and photographers. This component owns the state and the realtime plumbing; the screen itself is
 * made of three presentational components (conversation list, thread, composer).
 * - Messages appear instantly (optimistic) and are confirmed by the server in the background, over the WebSocket when it is up and over REST when it is not.
 * - Incoming messages, read receipts and the other person's "typing…" indicator arrive live; nothing needs a page reload.
 */
@Component({
  selector: 'app-messages-page',
  imports: [IconComponent, EmptyStateComponent, ErrorStateComponent, PageHeaderComponent, ConversationListComponent, ChatThreadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <app-page-header title="Messages" [subtitle]="rt.connected() ? 'Live — messages arrive instantly.' : 'Chat about your bookings.'" />
  @if (list.error() && !convs().length) { <app-error-state [error]="list.error()" (retry)="list.reload()" /> }
  @else if (list.isLoading() && !loaded()) { <div class="skeleton" style="height: 420px"></div> }
  @else if (!convs().length) { <div class="card"><app-empty-state icon="message" title="No conversations yet" [text]="isClient() ? 'Open a photographer’s profile and press “Message” to start a conversation.' : 'Customers can message you from your profile or a booking.'" [actionLabel]="isClient() ? 'Find photographers' : ''" actionLink="/discover" /></div> }
  @else {
  <div class="chat card" [class.has]="!!current()">
    <app-conversation-list [conversations]="convs()" [activeId]="activeId()" [meId]="me()?.id" [isClient]="isClient()" [typing]="typingIn()" (select)="select($event)" (remove)="remove($event)" />
    <section class="pane">
      @if (current(); as c) {
        <app-chat-thread
          [conversation]="c" [meId]="me()?.id" [otherId]="otherId(c)" [otherName]="other(c)" [otherAvatar]="avatar(c)" [subtitle]="subtitle(c)"
          [typing]="!!typingIn()[c.id]" [hasMore]="hasMore(c)" [loadingOlder]="olderState()[c.id] === 'loading'" [draft]="draft()"
          (back)="back()" (send)="send()" (retry)="retry(c, $event)" (loadOlder)="loadOlder(c)" (draftChange)="onType($event)" />
      } @else {
        <div class="empty">
          <span class="ring"><app-icon name="message-circle" [size]="30" /></span>
          <h2>Your messages</h2>
          <p>Choose a conversation from the list to read it and reply.</p>
        </div>
      }
    </section>
  </div> }`,
  styles: `
    .chat { display: grid; grid-template-columns: 340px minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); height: clamp(460px, calc(100dvh - var(--header-h) - 170px), 780px); overflow: hidden; border-radius: 18px; }
    .pane { display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow: hidden; }
    .empty { margin: auto; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; padding: 24px; color: var(--c-text-muted); }
    .empty h2 { font-size: 1.15rem; color: var(--c-ink); }
    .empty p { max-width: 34ch; font-size: 14px; }
    .ring { width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; background: var(--c-surface-2); color: var(--c-text-muted); }
    @media (max-width: 1000px) { .chat { grid-template-columns: 280px minmax(0, 1fr); } }
    @media (max-width: 760px) {
      .chat { grid-template-columns: minmax(0, 1fr); border-radius: 14px; }
      .chat.has app-conversation-list, .chat:not(.has) .pane { display: none; }
      .chat.has .pane { animation: slide-in .22s ease-out; }
    }
    @keyframes slide-in { from { transform: translateX(24px); opacity: 0; } to { transform: none; opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { .chat.has .pane { animation: none; } }
  `,
})
export class MessagesPage {
  private repo = inject(MessagingRepository); private session = inject(SessionStore); private toast = inject(ToastService); private confirm = inject(ConfirmService);
  readonly rt = inject(RealtimeService);
  readonly me = this.session.user; readonly isClient = computed(() => this.session.role() === 'client');
  readonly list = rxResource({ params: () => 1, stream: () => this.repo.conversations() });

  /** Local copy of the conversations: live events and optimistic messages are applied here, so the screen never waits for a reload. */
  readonly convs = signal<Conversation[]>([]); readonly loaded = signal(false);
  readonly activeId = signal<string | null>(null);
  /** Unsent text per conversation, so switching chats never loses what was typed. */
  private drafts = signal<Record<string, string>>({});
  readonly draft = computed(() => this.drafts()[this.activeId() ?? ''] ?? '');
  readonly typingIn = signal<Record<string, true>>({});
  /** Paging state of older history per conversation. */
  readonly olderState = signal<Record<string, 'idle' | 'loading' | 'done'>>({});
  readonly current = computed(() => this.convs().find(c => c.id === this.activeId()) ?? null);
  private typingTimers = new Map<string, ReturnType<typeof setTimeout>>(); private lastTypingSent = 0; private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private ackTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Conversation the server currently believes is open on my screen. */
  private focusedId: string | null = null;

  constructor() {
    inject(SeoService).set('Messages');
    effect(() => { const l = this.list.value(); if (!l) return; untracked(() => this.merge(l)); });
    effect(() => { const l = this.convs(); if (l.length && !untracked(() => this.activeId()) && window.innerWidth > 760) untracked(() => this.select(l[0])); });
    const sub = this.rt.chat$.subscribe(e => this.onEvent(e)); const sub2 = this.rt.reconnected$.subscribe(() => this.list.reload());
    // When the socket is down fall back to light polling so the chat still moves along.
    const poll = setInterval(() => { if (!this.rt.connected() && document.visibilityState === 'visible') this.list.reload(); }, 6000);
    // Back in the tab: tell the server this chat is on screen again and clear what arrived meanwhile.
    const onVisible = () => { this.syncFocus(); const c = this.current(); if (c && document.visibilityState === 'visible' && this.unread(c)) this.markReadNow(c); };
    document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => { document.removeEventListener('visibilitychange', onVisible); if (this.focusedId) this.rt.focus(this.focusedId, false); sub.unsubscribe(); sub2.unsubscribe(); clearInterval(poll); this.typingTimers.forEach(clearTimeout); this.ackTimers.forEach(clearTimeout); this.stopTyping(); });
  }

  other(c: Conversation) { return this.isClient() ? c.photographerName : c.customerName; }
  otherId(c: Conversation) { return this.isClient() ? c.photographerId : c.customerId; }
  avatar(c: Conversation) { return avatarImage(this.other(c)); }
  subtitle(c: Conversation) { return c.bookingId ? 'Linked to a booking' : this.isClient() ? 'Photographer' : 'Customer'; }
  private unread(c: Conversation) { return c.unreadFor[this.me()?.id ?? ''] ?? 0; }
  hasMore(c: Conversation) { return (this.olderState()[c.id] ?? 'idle') !== 'done' && c.messages.filter(m => !m.status).length >= PAGE; }

  /** Server list → local state, keeping older history that was already loaded and messages that are still being sent. */
  private merge(server: Conversation[]) {
    const mine = new Map(this.convs().map(c => [c.id, c]));
    this.convs.set(server.map(s => ({ ...s, messages: mergeMessages(mine.get(s.id)?.messages ?? [], s.messages) })));
    this.loaded.set(true);
  }
  private patch(id: string, fn: (c: Conversation) => Conversation) { this.convs.update(l => l.map(c => (c.id === id ? fn(c) : c)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))); }

  select(c: Conversation) {
    if (c.id !== this.activeId()) this.stopTyping(); // leaving a conversation must switch our "typing…" off for the other person
    this.activeId.set(c.id);
    if (this.unread(c)) this.markReadNow(c);
    this.syncFocus();
  }
  back() { this.stopTyping(); this.activeId.set(null); this.syncFocus(); }

  private markReadNow(c: Conversation) {
    this.patch(c.id, x => ({ ...x, unreadFor: { ...x.unreadFor, [this.me()?.id ?? '']: 0 } }));
    this.repo.markRead(c.id).subscribe({ error: () => undefined });
  }
  /** Tells the server which chat is really on screen (open AND tab visible): messages arriving there are read at once and raise no notification. */
  private syncFocus() {
    const id = this.activeId(); const want = id && document.visibilityState === 'visible' ? id : null;
    if (want === this.focusedId) return;
    if (this.focusedId) this.rt.focus(this.focusedId, false);
    if (want) this.rt.focus(want, true);
    this.focusedId = want;
  }
  private dropLocal(id: string) { this.convs.update(l => l.filter(c => c.id !== id)); if (this.activeId() === id) { this.activeId.set(null); this.syncFocus(); } }
  async remove(c: Conversation) {
    const r = await this.confirm.ask({ title: 'Delete this conversation?', message: `It is removed from your list only. ${this.other(c)} keeps their copy, and a new message from them brings the chat back.`, confirmText: 'Delete', danger: true });
    if (!r.ok) return;
    this.repo.deleteConversation(c.id).subscribe({ next: () => this.dropLocal(c.id), error: e => this.toast.error(errorText(e)) });
  }

  /** Loads the page of history before the oldest message on screen and puts it above, without moving what the reader is looking at. */
  loadOlder(c: Conversation) {
    if ((this.olderState()[c.id] ?? 'idle') !== 'idle') return;
    const oldest = c.messages.find(m => !m.status)?.at; if (!oldest) return;
    this.olderState.update(s => ({ ...s, [c.id]: 'loading' }));
    this.repo.older(c.id, oldest, PAGE).subscribe({
      next: page => {
        this.patch(c.id, x => ({ ...x, messages: prependOlder(x.messages, page) }));
        this.olderState.update(s => ({ ...s, [c.id]: page.length < PAGE ? 'done' : 'idle' }));
      },
      error: e => { this.olderState.update(s => ({ ...s, [c.id]: 'idle' })); this.toast.error(errorText(e)); },
    });
  }

  private onEvent(e: ChatEventDto) {
    if (e.type === 'deleted') { this.dropLocal(e.conversationId); return; }
    const known = this.convs().some(c => c.id === e.conversationId);
    if (e.type === 'typing' || e.type === 'typing_stopped') { this.setTyping(e.conversationId, e.type === 'typing'); return; }
    if (!known) { this.list.reload(); return; }
    if (e.type === 'read') { if (e.unreadFor) this.patch(e.conversationId, c => ({ ...c, unreadFor: e.unreadFor! })); return; }
    const m = e.message; if (!m) return;
    const msg: ChatMessage = { id: m.id, senderId: m.senderId, senderRole: m.senderRole.toLowerCase() as Role, text: m.text, at: m.at, clientMessageId: m.clientMessageId };
    this.acked(msg.clientMessageId);
    this.patch(e.conversationId, c => {
      const i = c.messages.findIndex(x => x.id === msg.id || (!!msg.clientMessageId && x.clientMessageId === msg.clientMessageId));
      const messages = i >= 0 ? c.messages.map((x, k) => (k === i ? msg : x)) : [...c.messages, msg];
      return { ...c, messages, updatedAt: msg.at, unreadFor: e.unreadFor ?? c.unreadFor };
    });
    if (msg.senderId !== this.me()?.id) {
      this.setTyping(e.conversationId, false);
      if (this.activeId() === e.conversationId && document.visibilityState === 'visible' && (e.unreadFor?.[this.me()?.id ?? ''] ?? 1) > 0) { const c = this.convs().find(x => x.id === e.conversationId); if (c) this.markReadNow(c); }
    }
  }

  private setTyping(id: string, on: boolean) {
    clearTimeout(this.typingTimers.get(id));
    this.typingIn.update(t => { const n = { ...t }; if (on) n[id] = true; else delete n[id]; return n; });
    if (on) this.typingTimers.set(id, setTimeout(() => this.setTyping(id, false), 4000)); // a lost "stopped" signal must not leave the dots on forever
  }

  private setDraft(id: string, v: string) { this.drafts.update(d => ({ ...d, [id]: v })); }

  /** Stores the draft, tells the other person we are typing (at most every 2 s), and that we stopped after 2.5 s of silence. */
  onType(v: string) {
    const c = this.current(); if (!c) return;
    this.setDraft(c.id, v);
    if (this.stopTimer) clearTimeout(this.stopTimer);
    if (!v.trim()) { this.stopTyping(); return; }
    const now = Date.now(); if (now - this.lastTypingSent > 2000) { this.lastTypingSent = now; this.rt.sendTyping(c.id, true); }
    this.stopTimer = setTimeout(() => this.stopTyping(), 2500);
  }
  stopTyping() {
    if (this.stopTimer) { clearTimeout(this.stopTimer); this.stopTimer = null; }
    const c = this.current(); if (c && this.lastTypingSent) { this.rt.sendTyping(c.id, false); } this.lastTypingSent = 0;
  }

  /** Shows the message at once, clears the box, then delivers it in the background. */
  send() {
    const c = this.current(); const body = this.draft().trim(); const meId = this.me()?.id; if (!c || !body || !meId) return;
    this.stopTyping(); this.setDraft(c.id, '');
    const clientMessageId = crypto.randomUUID();
    const pending: ChatMessage = { id: 'tmp-' + clientMessageId, senderId: meId, senderRole: this.session.role() ?? 'client', text: body, at: new Date().toISOString(), clientMessageId, status: 'sending' };
    this.patch(c.id, x => ({ ...x, messages: [...x.messages, pending], updatedAt: pending.at }));
    this.deliver(c.id, pending);
  }
  retry(c: Conversation, m: ChatMessage) {
    this.patch(c.id, x => ({ ...x, messages: x.messages.map(y => (y.clientMessageId === m.clientMessageId ? { ...y, status: 'sending' as const } : y)) }));
    this.deliver(c.id, m);
  }
  private deliver(conversationId: string, m: ChatMessage) {
    const id = m.clientMessageId!;
    if (this.rt.sendMessage(conversationId, m.text, id)) {
      // The server echoes the stored message back (matched by clientMessageId). If that does not happen in time, resend over REST: the id makes it idempotent.
      this.ackTimers.set(id, setTimeout(() => { this.ackTimers.delete(id); this.viaRest(conversationId, m); }, 6000));
    } else this.viaRest(conversationId, m);
  }
  private viaRest(conversationId: string, m: ChatMessage) {
    this.repo.post(conversationId, m.text, m.clientMessageId!).subscribe({
      next: saved => this.patch(conversationId, c => ({ ...c, messages: c.messages.map(x => (x.clientMessageId === saved.clientMessageId ? saved : x)) })),
      error: e => { this.patch(conversationId, c => ({ ...c, messages: c.messages.map(x => (x.clientMessageId === m.clientMessageId ? { ...x, status: 'failed' as const } : x)) })); this.toast.error(errorText(e)); },
    });
  }
  private acked(clientMessageId?: string) { if (!clientMessageId) return; clearTimeout(this.ackTimers.get(clientMessageId)); this.ackTimers.delete(clientMessageId); }
}