import { HttpEventType, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, filter, map, switchMap, tap } from 'rxjs';
import { AutomationRepository, MessagingRepository, NotificationRepository, UploadRepository } from '../api/repositories';
import { AppNotification, AutomationSettings, ChatMessage, Conversation, NotificationType, Role } from '../models';
import { avatarImage } from '../util/images';
import { useApi } from './api';

const enc = encodeURIComponent;

interface NotificationDto { id: string; userId: string; type: string; title: string; body: string; createdAt: string; read: boolean; link?: string }
interface MessageDto { id: string; senderId: string; senderRole: string; text: string; at: string; clientMessageId?: string }
interface ConversationDto {
  id: string; bookingId?: string; customerId: string; customerName: string; photographerId: string; photographerName: string;
  messages: MessageDto[]; unreadFor: Record<string, number>; updatedAt: string;
}

export const toMessage = (m: MessageDto): ChatMessage => ({ id: m.id, senderId: m.senderId, senderRole: m.senderRole.toLowerCase() as Role, text: m.text, at: m.at, clientMessageId: m.clientMessageId });

/** GET /notifications, POST /notifications/{id}/read, POST /notifications/read-all */
@Injectable()
export class HttpNotificationRepository extends NotificationRepository {
  private api = useApi();
  override list(): Observable<AppNotification[]> {
    return this.api.get<NotificationDto[]>('/notifications').pipe(map(l => l.map(n => ({ ...n, type: n.type.toLowerCase() as NotificationType }))));
  }
  override markRead(id: string | 'all'): Observable<void> {
    return (id === 'all' ? this.api.post<unknown>('/notifications/read-all') : this.api.post<unknown>(`/notifications/${enc(id)}/read`)).pipe(map(() => undefined));
  }
  override remove(id: string): Observable<void> { return this.api.delete<unknown>(`/notifications/${enc(id)}`).pipe(map(() => undefined)); }
  override clear(scope: 'all' | 'read'): Observable<void> { return this.api.delete<unknown>(`/notifications?scope=${scope}`).pipe(map(() => undefined)); }
}

/** /messages/** (REST). Live delivery happens over STOMP (see RealtimeService); these calls load history, send as a fallback and mark conversations read. */
@Injectable()
export class HttpMessagingRepository extends MessagingRepository {
  private api = useApi();
  private toConversation = (c: ConversationDto): Conversation => ({
    id: c.id, bookingId: c.bookingId, customerId: c.customerId, customerName: c.customerName, photographerId: c.photographerId, photographerName: c.photographerName,
    photographerAvatar: avatarImage(c.photographerName),
    messages: c.messages.map(toMessage),
    unreadFor: c.unreadFor ?? {}, updatedAt: c.updatedAt,
  });
  override conversations(): Observable<Conversation[]> { return this.api.get<ConversationDto[]>('/messages/conversations').pipe(map(l => l.map(this.toConversation))); }
  override send(conversationId: string, text: string): Observable<Conversation> {
    return this.api.post<MessageDto>(`/messages/conversations/${enc(conversationId)}/messages`, { text, clientMessageId: crypto.randomUUID() }).pipe(
      switchMap(() => this.api.get<ConversationDto>(`/messages/conversations/${enc(conversationId)}`)), map(this.toConversation));
  }
  override post(conversationId: string, text: string, clientMessageId: string): Observable<ChatMessage> {
    return this.api.post<MessageDto>(`/messages/conversations/${enc(conversationId)}/messages`, { text, clientMessageId }).pipe(map(toMessage));
  }
  override start(photographerId: string, bookingId?: string): Observable<Conversation> {
    return this.api.post<ConversationDto>('/messages/conversations', { username: photographerId, bookingId }).pipe(map(this.toConversation));
  }
  override markRead(conversationId: string): Observable<void> { return this.api.post<unknown>(`/messages/conversations/${enc(conversationId)}/read`).pipe(map(() => undefined)); }
  override deleteConversation(conversationId: string): Observable<void> { return this.api.delete<unknown>(`/messages/conversations/${enc(conversationId)}`).pipe(map(() => undefined)); }
  override older(conversationId: string, before: string, limit = 50): Observable<ChatMessage[]> {
    const params = new HttpParams().set('before', before).set('limit', String(limit));
    return this.api.get<ConversationDto>(`/messages/conversations/${enc(conversationId)}`, params).pipe(map(c => c.messages.map(toMessage)));
  }
}

/** POST /uploads (multipart). The server decides the file type from its content and stores it; the returned URL is what gets saved on the profile. */
@Injectable()
export class HttpUploadRepository extends UploadRepository {
  private api = useApi();
  override uploadAvatar(file: File): Observable<{ url: string }> { return this.send('/uploads/avatar', file); }
  override upload(file: File, onProgress?: (pct: number) => void): Observable<{ url: string }> { return this.send('/uploads', file, onProgress); }
  private send(path: string, file: File, onProgress?: (pct: number) => void): Observable<{ url: string }> {
    const form = new FormData(); form.append('file', file, file.name);
    return this.api.http.post<{ url: string }>(this.api.url(path), form, { reportProgress: true, observe: 'events' }).pipe(
      tap(ev => { if (ev.type === HttpEventType.UploadProgress && ev.total) onProgress?.(Math.round((100 * ev.loaded) / ev.total)); }),
      filter((ev): ev is HttpResponse<{ url: string }> => ev.type === HttpEventType.Response),
      map(r => r.body as { url: string }),
    );
  }
}

/** GET/PUT /photographers/me/automation. The rules are executed by the server. */
@Injectable()
export class HttpAutomationRepository extends AutomationRepository {
  private api = useApi();
  override get(): Observable<AutomationSettings> { return this.api.get<AutomationSettings>('/photographers/me/automation'); }
  override save(settings: AutomationSettings): Observable<AutomationSettings> { return this.api.put<AutomationSettings>('/photographers/me/automation', settings); }
}