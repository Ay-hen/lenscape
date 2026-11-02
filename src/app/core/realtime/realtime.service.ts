import { Injectable, NgZone, effect, inject, signal } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import { Subject } from 'rxjs';
import { SessionStore } from '../auth/session.store';
import { APP_ENV } from '../config/app-config';

/** What the server pushes on /user/queue/messages. `typing` / `typing_stopped` are live signals from the other participant and are never stored. */
export interface ChatEventDto {
  type: 'message' | 'read' | 'typing' | 'typing_stopped' | 'deleted';
  conversationId: string;
  message?: { id: string; senderId: string; senderRole: string; text: string; at: string; clientMessageId?: string } | null;
  unreadFor?: Record<string, number> | null;
  actor?: string; at?: string;
}
export interface NotificationPushDto { id: string; userId: string; type: string; title: string; body: string; createdAt: string; read: boolean; link?: string }

/**
 * One STOMP-over-WebSocket connection per signed-in user (the server exposes it at `/ws`).
 * It carries chat messages, "is typing" signals and notification pushes, so nothing has to wait for a page reload or a refresh button.
 * When the socket is down callers fall back to REST (see MessagesPage), and the client keeps trying to reconnect by itself.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private session = inject(SessionStore); private env = inject(APP_ENV); private zone = inject(NgZone);
  readonly connected = signal(false);
  readonly chat$ = new Subject<ChatEventDto>();
  readonly notification$ = new Subject<NotificationPushDto>();
  readonly error$ = new Subject<{ code: string; message: string }>();
  /** Fires after every (re)connection so screens can catch up on what they missed while offline. */
  readonly reconnected$ = new Subject<void>();
  private client: Client | null = null; private connectedFor: string | null = null;
  /** Conversation currently open on screen; announced again after every reconnect. */
  private focused: string | null = null;

  constructor() {
    effect(() => { const token = this.session.token(); if (token) this.connect(token); else this.disconnect(); });
  }

  private wsUrl() { return this.env.apiBaseUrl.replace(/^http/i, 'ws') + '/ws'; }

  private connect(token: string) {
    if (this.connectedFor === token && this.client) return;
    this.disconnect(); this.connectedFor = token;
    const client = new Client({
      brokerURL: this.wsUrl(), connectHeaders: { Authorization: `Bearer ${token}` }, reconnectDelay: 4000, heartbeatIncoming: 10000, heartbeatOutgoing: 10000,
      onConnect: () => {
        this.zone.run(() => { this.connected.set(true); this.reconnected$.next(); });
        client.subscribe('/user/queue/messages', m => this.zone.run(() => this.emit(this.chat$, m)));
        client.subscribe('/user/queue/notifications', m => this.zone.run(() => this.emit(this.notification$, m)));
        client.subscribe('/user/queue/errors', m => this.zone.run(() => this.emit(this.error$, m)));
        if (this.focused) this.publish('/app/chat.focus', { conversationId: this.focused, active: true });
      },
      onWebSocketClose: () => this.zone.run(() => this.connected.set(false)),
      onStompError: () => this.zone.run(() => this.connected.set(false)),
    });
    this.client = client; client.activate();
  }

  private disconnect() {
    const c = this.client; this.client = null; this.connectedFor = null; this.connected.set(false);
    if (c) void c.deactivate();
  }

  private emit<T>(subject: Subject<T>, m: IMessage) { try { subject.next(JSON.parse(m.body) as T); } catch { /* ignore malformed frame */ } }

  /** Returns false when the socket is not connected so the caller can use REST instead. */
  sendMessage(conversationId: string, text: string, clientMessageId: string): boolean {
    return this.publish('/app/chat.send', { conversationId, text, clientMessageId });
  }
  /** Tells the server which conversation is open on screen: messages arriving there are read at once and raise no notification. */
  focus(conversationId: string, active: boolean): void {
    if (active) this.focused = conversationId; else if (this.focused === conversationId) this.focused = null;
    this.publish('/app/chat.focus', { conversationId, active });
  }
  sendTyping(conversationId: string, typing: boolean): void { this.publish('/app/chat.typing', { conversationId, typing }); }

  private publish(destination: string, body: unknown): boolean {
    const c = this.client; if (!c || !c.connected) return false;
    try { c.publish({ destination, body: JSON.stringify(body) }); return true; } catch { return false; }
  }
}