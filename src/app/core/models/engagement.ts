import { ISODateTime } from './common';
import { Role } from './common';

export type NotificationType = 'booking' | 'message' | 'review' | 'system' | 'approval';
export interface AppNotification { id: string; userId: string; type: NotificationType; title: string; body: string; createdAt: ISODateTime; read: boolean; link?: string }

export interface ChatMessage {
  id: string; senderId: string; senderRole: Role; text: string; at: ISODateTime;
  /** Client-generated id: lets a message that is shown instantly be matched with the server's copy. */
  clientMessageId?: string;
  /** Only set on the sender's device while the message is on its way / if it could not be delivered. */
  status?: 'sending' | 'failed';
}
export interface Conversation {
  id: string;
  bookingId?: string;
  customerId: string;
  customerName: string;
  photographerId: string;
  photographerName: string;
  photographerAvatar: string;
  messages: ChatMessage[];
  unreadFor: Record<string, number>;
  updatedAt: ISODateTime;
}

export interface MessageTemplate { id: string; name: string; body: string; kind: 'message' | 'quotation' }

export interface AutomationSettings {
  photographerId: string;
  bookingRequestNotify: { enabled: boolean; email: boolean; inApp: boolean };
  confirmationMessage: { enabled: boolean; templateId: string };
  reminders: { enabled: boolean; hoursBefore: number[]; templateId: string };
  followUp: { enabled: boolean; delayHours: number; templateId: string };
  reviewRequest: { enabled: boolean; delayHours: number };
  autoExpire: { enabled: boolean; afterHours: number };
  pendingNudge: { enabled: boolean; afterHours: number };
  autoAccept: { enabled: boolean; minNoticeHours: number; maxPriceMad: number | null; repeatCustomersOnly: boolean };
  repeatCustomerOffer: { enabled: boolean; percent: number };
  galleryTracking: { enabled: boolean };
  templates: MessageTemplate[];
  updatedAt: ISODateTime;
}
