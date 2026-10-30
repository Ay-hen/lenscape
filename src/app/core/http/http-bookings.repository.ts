import { Injectable } from '@angular/core';
import { Observable, map, throwError } from 'rxjs';
import { BookingRepository, FavoriteRepository, PaymentRepository, ReviewRepository } from '../api/repositories';
import { ApiError, Booking, BookingQuery, BookingStatus, CreateBookingRequest, ISODate, Page, PriceBreakdown, QuoteRequest, Review } from '../models';
import { useApi } from './api';
import { toParams, withBookingMedia } from './http-util';

const enc = encodeURIComponent;

/** /bookings/** — price, availability, permissions and refunds are decided by the server. */
@Injectable()
export class HttpBookingRepository extends BookingRepository {
  private api = useApi();
  override quote(req: QuoteRequest): Observable<PriceBreakdown> { return this.api.post<PriceBreakdown>('/bookings/quote', req); }
  override create(req: CreateBookingRequest): Observable<Booking> { return this.api.post<Booking>('/bookings', req).pipe(map(withBookingMedia)); }
  override list(q: BookingQuery): Observable<Page<Booking>> {
    const params = toParams({ status: q.status && q.status !== 'all' ? q.status : undefined, q: q.q, from: q.from, to: q.to, photographerId: q.photographerId, customerId: q.customerId, page: q.page, pageSize: q.pageSize });
    return this.api.get<Page<Booking>>('/bookings', params).pipe(map(r => ({ ...r, items: r.items.map(withBookingMedia) })));
  }
  override get(id: string): Observable<Booking> { return this.api.get<Booking>(`/bookings/${enc(id)}`).pipe(map(withBookingMedia)); }
  override setStatus(id: string, status: BookingStatus, note?: string): Observable<Booking> { return this.api.patch<Booking>(`/bookings/${enc(id)}/status`, { status, note }).pipe(map(withBookingMedia)); }
  override cancel(id: string, reason: string): Observable<Booking> { return this.api.post<Booking>(`/bookings/${enc(id)}/cancel`, { reason }).pipe(map(withBookingMedia)); }
  override requestReschedule(id: string, date: ISODate, startTime: string): Observable<Booking> { return this.api.post<Booking>(`/bookings/${enc(id)}/reschedule`, { date, startTime }).pipe(map(withBookingMedia)); }
  override respondReschedule(id: string, accept: boolean): Observable<Booking> { return this.api.post<Booking>(`/bookings/${enc(id)}/reschedule/respond`, { accept }).pipe(map(withBookingMedia)); }
  override setDelivery(id: string, status: Booking['deliveryStatus']): Observable<Booking> { return this.api.patch<Booking>(`/bookings/${enc(id)}/delivery`, { status }).pipe(map(withBookingMedia)); }
  override openDispute(id: string, reason: string): Observable<Booking> { return this.api.post<Booking>(`/bookings/${enc(id)}/dispute`, { reason }).pipe(map(withBookingMedia)); }
  override resolveDispute(id: string, resolution: string): Observable<Booking> { return this.api.post<Booking>(`/bookings/${enc(id)}/dispute/resolve`, { resolution }).pipe(map(withBookingMedia)); }
  override markRefund(id: string, kind: 'refunded' | 'partially_refunded'): Observable<Booking> { return this.api.post<Booking>(`/bookings/${enc(id)}/refund`, { kind }).pipe(map(withBookingMedia)); }
}

/** No payment provider is integrated. This never pretends a payment happened. */
@Injectable()
export class HttpPaymentRepository extends PaymentRepository {
  override available(): boolean { return false; }
  override createIntent(): Observable<{ clientSecret: string }> {
    return throwError(() => new ApiError('NOT_IMPLEMENTED', 'Online payment is not available yet.', 501));
  }
}

@Injectable()
export class HttpReviewRepository extends ReviewRepository {
  private api = useApi();
  override submit(bookingId: string, rating: number, comment: string): Observable<Review> { return this.api.post<Review>(`/bookings/${enc(bookingId)}/review`, { rating, comment }); }
  override reply(reviewId: string, text: string): Observable<Review> { return this.api.post<Review>(`/reviews/${enc(reviewId)}/reply`, { text }); }
}

@Injectable()
export class HttpFavoriteRepository extends FavoriteRepository {
  private api = useApi();
  override list(): Observable<string[]> { return this.api.get<string[]>('/favorites'); }
  override toggle(photographerId: string): Observable<string[]> { return this.api.post<string[]>(`/favorites/${enc(photographerId)}/toggle`); }
}
