import { Currency, GeoPoint, ISODate, ISODateTime, TimeOfDay } from './common';
import { PackageTier, PricingModel } from './catalog';

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rejected' | 'expired';
export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'partially_refunded' | 'refunded';
export type DeliveryStatus = 'not_started' | 'editing' | 'delivered';

export interface PriceBreakdown {
  pricingModel: PricingModel;
  packagePrice: number;
  addOnsTotal: number;
  discount: number;
  promoCode?: string;
  subtotal: number;
  /** Platform fee — shown to photographers/admin only, never added to the customer total in this prototype. */
  platformFee: number;
  total: number;
  currency: Currency;
  /** Server-issued token; the frontend echoes it back so price changes can be detected. */
  quoteId: string;
}

export interface BookingEvent { at: ISODateTime; actor: string; type: string; note?: string }

export interface BookingLocation { address: string; city: string; point?: GeoPoint }

export interface Booking {
  id: string;
  reference: string;
  customerId: string;
  customerName: string;
  photographerId: string;
  photographerName: string;
  photographerAvatar: string;
  serviceId: string;
  serviceTitle: string;
  categoryId: string;
  packageId: string;
  packageName: string;
  tier: PackageTier;
  date: ISODate;
  startTime: TimeOfDay;
  endTime: TimeOfDay;
  durationMinutes: number;
  location: BookingLocation;
  addOns: { id: string; name: string; price: number }[];
  notes: string;
  pricing: PriceBreakdown;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  deliveryStatus: DeliveryStatus;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  history: BookingEvent[];
  reviewed: boolean;
  rescheduleRequest?: { date: ISODate; startTime: TimeOfDay; requestedBy: 'client' | 'photographer'; at: ISODateTime };
  cancellation?: { by: 'client' | 'photographer' | 'admin'; reason: string; at: ISODateTime; refundPercent: number };
  dispute?: { state: 'open' | 'resolved'; reason: string; openedAt: ISODateTime; resolution?: string };
}

export interface QuoteRequest {
  photographerId: string;
  serviceId: string;
  packageId: string;
  addOnIds: string[];
  promoCode?: string;
  hours?: number;
}

export interface CreateBookingRequest extends QuoteRequest {
  date: ISODate;
  startTime: TimeOfDay;
  categoryId: string;
  location: BookingLocation;
  notes: string;
  /** Price the customer saw. Backend MUST recompute and reject on mismatch (PRICE_CHANGED). */
  expectedTotal: number;
  quoteId: string;
  /** Prevents duplicate submissions on double-click / retry. */
  idempotencyKey: string;
}

export interface BookingQuery { status?: BookingStatus | 'all'; q?: string; from?: ISODate; to?: ISODate; photographerId?: string; customerId?: string; page: number; pageSize: number }
