import { Observable } from 'rxjs';
import {
  AdminOverview, Album, Application, AuditEntry, AutomationSettings, AvailabilityRules, Booking, BookingQuery, BookingStatus,
  Category, ChatMessage, ContentReport, CreateBookingRequest, Conversation, CustomerProfile, DateRange, GeoPoint, ISODate,
  LoginRequest, AppNotification, Page, PageQuery, PhotographerProfile, PhotographerQuery, PhotographerSummary, PlatformSettings,
  PortfolioImage, PriceBreakdown, PromoCode, QuoteRequest, RegisterCustomerRequest, RegisterPhotographerRequest, RegistrationStarted, Review, Service,
  ServicePackage, Session, Slot, User, MessageTemplate, Series, LocationInput } from '../models';

/**
 * Repository contracts. UI code depends ONLY on these abstract classes (used as DI tokens).
 * `core/http/*` provides the implementations that talk to the Spring Boot API (bound in `core/providers.ts`).
 * The `@endpoint` tags document the Spring Boot route each method calls; docs/ENDPOINTS.md lists them all.
 */

export interface PackageHighlight { pkg: ServicePackage; serviceTitle: string; pricingModel: Service['pricingModel']; photographer: PhotographerSummary }

export abstract class AuthRepository {
  /** @endpoint (legacy) POST /user/auth/login */ abstract login(req: LoginRequest): Observable<Session>;
  /** @endpoint (legacy) POST /user/auth/register (role: client) */ abstract registerCustomer(req: RegisterCustomerRequest): Observable<RegistrationStarted>;
  /** @endpoint (legacy) POST /user/auth/register (role: photographer) */ abstract registerPhotographer(req: RegisterPhotographerRequest): Observable<RegistrationStarted>;
  /** @endpoint NEW POST /auth/otp/verify — confirms the e-mailed code, creates the account and signs in */ abstract verifyEmail(email: string, otp: string): Observable<Session>;
  /** @endpoint NEW POST /auth/otp/resend — new code (60 s cooldown, 5 per hour) */ abstract resendCode(email: string): Observable<void>;
  /** @endpoint (legacy) POST /user/auth/logout — revokes the token it is given */ abstract logout(token: string): Observable<void>;
  /** @endpoint NEW GET /user/me */ abstract me(): Observable<User>;
  /** @endpoint NEW POST /auth/password */ abstract changePassword(current: string, next: string): Observable<void>;
}

export abstract class CustomerRepository {
  /** @endpoint NEW GET /customers/me */ abstract getProfile(): Observable<CustomerProfile>;
  /** @endpoint NEW PUT /customers/me */ abstract updateProfile(patch: Partial<CustomerProfile>): Observable<CustomerProfile>;
}

export abstract class CatalogRepository {
  /** @endpoint NEW GET /categories */ abstract categories(): Observable<Category[]>;
  /** @endpoint (legacy-ish) GET /user/photographers/{city} → generalised to a filtered, paged search */
  abstract search(q: PhotographerQuery): Observable<Page<PhotographerSummary>>;
  /** @endpoint NEW GET /photographers/{id} */ abstract photographer(id: string): Observable<PhotographerProfile>;
  /** @endpoint NEW GET /photographers/{id}/similar */ abstract similar(id: string): Observable<PhotographerSummary[]>;
  /** @endpoint NEW GET /photographers/{id}/services */ abstract services(photographerId: string, opts?: { includeUnpublished?: boolean }): Observable<Service[]>;
  /** @endpoint NEW GET /photographers/{id}/packages */ abstract packages(photographerId: string, opts?: { includeUnpublished?: boolean }): Observable<ServicePackage[]>;
  /** @endpoint NEW GET /photographers/{id}/reviews */ abstract reviews(photographerId: string): Observable<Review[]>;
  /** @endpoint NEW POST /photographers/{id}/view */ abstract recordView(photographerId: string): Observable<void>;
  abstract summaries(ids: string[]): Observable<PhotographerSummary[]>;
  /** @endpoint NEW GET /packages/best-value */ abstract bestValuePackages(limit: number): Observable<PackageHighlight[]>;
  /** @endpoint NEW GET /content/banner (public) — site-wide notice text, empty string when none */ abstract siteBanner(): Observable<string>;
  /** @endpoint NEW GET /content/faq (public) */ abstract faqs(): Observable<{ id: string; q: string; a: string }[]>;
  /** @endpoint NEW GET /reviews/featured (public) — latest highly rated REAL reviews; empty until customers have reviewed */ abstract testimonials(limit: number): Observable<Review[]>;
}

export abstract class PhotographerWorkspaceRepository {
  /** @endpoint NEW GET /photographers/me */ abstract myProfile(): Observable<PhotographerProfile>;
  /** @endpoint (legacy) POST /user/edit/photographer → PUT /photographers/me */ abstract updateProfile(patch: Partial<PhotographerProfile>): Observable<PhotographerProfile>;
  /** @endpoint NEW POST /photographers/me/submit */ abstract submitForApproval(): Observable<PhotographerProfile>;
  /**
   * @endpoint NEW PUT /photographers/me/location — the ONLY way to change where a photographer appears on the map.
   * freelancer: city + radius only, the server derives an approximate point. shop: exact coordinates required, published as-is.
   */
  abstract setLocation(input: LocationInput): Observable<PhotographerProfile>;
  abstract saveService(service: Partial<Service> & { title: string }): Observable<Service>;
  abstract setServiceStatus(id: string, status: Service['status']): Observable<Service>;
  abstract savePackage(pkg: Partial<ServicePackage> & { serviceId: string }): Observable<ServicePackage>;
  abstract setPackageStatus(id: string, status: ServicePackage['status']): Observable<ServicePackage>;
  abstract deletePackage(id: string): Observable<void>;
  abstract savePortfolio(images: PortfolioImage[], albums: Album[]): Observable<void>;
  abstract promoCodes(): Observable<PromoCode[]>;
  abstract savePromoCodes(codes: PromoCode[]): Observable<PromoCode[]>;
}

export abstract class AvailabilityRepository {
  /** @endpoint NEW GET /photographers/{id}/availability */ abstract rules(photographerId: string): Observable<AvailabilityRules>;
  /** @endpoint NEW PUT /photographers/me/availability */ abstract saveRules(rules: AvailabilityRules): Observable<AvailabilityRules>;
  /** @endpoint NEW GET /photographers/{id}/slots?date=&duration= — server is authoritative */
  abstract slots(photographerId: string, date: ISODate, durationMinutes: number): Observable<Slot[]>;
  /** Days of a month that have at least one free slot. */
  abstract openDays(photographerId: string, dates: ISODate[], durationMinutes: number): Observable<ISODate[]>;
}

export abstract class BookingRepository {
  /** @endpoint NEW POST /bookings/quote — server-authoritative price */ abstract quote(req: QuoteRequest): Observable<PriceBreakdown>;
  /** @endpoint (legacy) POST /user/create/reservation → POST /bookings (status starts as `pending`) */ abstract create(req: CreateBookingRequest): Observable<Booking>;
  /** @endpoint (legacy) GET /user/reservations/{username}, /user/reservations/all */ abstract list(q: BookingQuery): Observable<Page<Booking>>;
  abstract get(id: string): Observable<Booking>;
  /** @endpoint (legacy) POST /user/status → PATCH /bookings/{id}/status */ abstract setStatus(id: string, status: BookingStatus, note?: string): Observable<Booking>;
  /** @endpoint (legacy) DELETE /user/delete/reservation/{id} → POST /bookings/{id}/cancel */ abstract cancel(id: string, reason: string): Observable<Booking>;
  abstract requestReschedule(id: string, date: ISODate, startTime: string): Observable<Booking>;
  abstract respondReschedule(id: string, accept: boolean): Observable<Booking>;
  abstract setDelivery(id: string, status: Booking['deliveryStatus']): Observable<Booking>;
  abstract openDispute(id: string, reason: string): Observable<Booking>;
  abstract resolveDispute(id: string, resolution: string): Observable<Booking>;
  abstract markRefund(id: string, kind: 'refunded' | 'partially_refunded'): Observable<Booking>;
}

export abstract class PaymentRepository {
  /** Not available until the backend + a payment provider exist. MUST NOT fake a successful payment. */
  abstract available(): boolean;
  abstract createIntent(bookingId: string): Observable<{ clientSecret: string }>;
}

export abstract class ReviewRepository {
  abstract submit(bookingId: string, rating: number, comment: string): Observable<Review>;
  abstract reply(reviewId: string, text: string): Observable<Review>;
}

export abstract class FavoriteRepository {
  abstract list(): Observable<string[]>;
  abstract toggle(photographerId: string): Observable<string[]>;
}

export abstract class NotificationRepository {
  abstract list(): Observable<AppNotification[]>;
  abstract markRead(id: string | 'all'): Observable<void>;
}

export abstract class MessagingRepository {
  abstract conversations(): Observable<Conversation[]>;
  abstract send(conversationId: string, text: string): Observable<Conversation>;
  /** Posts one message (idempotent through clientMessageId) and returns only that message — no history reload. */
  abstract post(conversationId: string, text: string, clientMessageId: string): Observable<ChatMessage>;
  abstract start(photographerId: string, bookingId?: string): Observable<Conversation>;
  abstract markRead(conversationId: string): Observable<void>;
  /** One page of history older than `before` (ISO timestamp of the oldest message already loaded), returned oldest-first. */
  abstract older(conversationId: string, before: string, limit?: number): Observable<ChatMessage[]>;
}

export abstract class UploadRepository {
  /** @endpoint NEW POST /uploads (multipart) → returns a storage URL. Backend validates type/size and scans. */
  abstract upload(file: File, onProgress?: (pct: number) => void): Observable<{ url: string }>;
  /** @endpoint NEW POST /uploads/avatar (multipart) — profile pictures; open to every signed-in account, customers included. */
  abstract uploadAvatar(file: File): Observable<{ url: string }>;
}

export abstract class AutomationRepository {
  abstract get(): Observable<AutomationSettings>;
  abstract save(settings: AutomationSettings): Observable<AutomationSettings>;
}

export abstract class AdminRepository {
  abstract overview(): Observable<AdminOverview>;
  abstract users(q: PageQuery & { role?: User['role'] | 'all'; status?: User['status'] | 'all' }): Observable<Page<User>>;
  /** @endpoint (legacy) GET /user/suspension/{u}, /user/unsuspension/{u}, DELETE /user/delete/user/{u} */
  abstract setUserStatus(id: string, status: User['status'], reason?: string): Observable<User>;
  abstract applications(): Observable<Application[]>;
  abstract decideApplication(photographerId: string, action: 'approved' | 'rejected' | 'info_requested' | 'identity_verified', note: string): Observable<Application>;
  abstract allServices(): Observable<Service[]>;
  abstract allPackages(): Observable<ServicePackage[]>;
  abstract moderateService(id: string, state: Service['moderation'], featured?: boolean): Observable<Service>;
  abstract reports(): Observable<ContentReport[]>;
  abstract resolveReport(id: string, state: ContentReport['state']): Observable<ContentReport>;
  abstract report(targetType: ContentReport['targetType'], targetId: string, targetLabel: string, reason: string): Observable<void>;
  abstract audit(): Observable<AuditEntry[]>;
  abstract settings(): Observable<PlatformSettings>;
  abstract saveSettings(s: PlatformSettings): Observable<PlatformSettings>;
}

export interface AnalyticsBundle {
  bookingsOverTime: Series;
  revenueOverTime: Series;
  cancellationsOverTime: Series;
  customerAcquisition: Series;
  popularServices: { label: string; value: number }[];
  topPhotographers: { name: string; bookings: number; revenue: number; rating: number }[];
  conversion: { label: string; value: number }[];
}
export abstract class AnalyticsRepository {
  abstract platform(range: DateRange): Observable<AnalyticsBundle>;
  abstract photographer(photographerId: string, range: DateRange): Observable<PhotographerAnalytics>;
}
export interface PhotographerAnalytics {
  revenue: Series;
  bookings: Series;
  views: Series;
  conversionRate: number;
  views30d: number;
  requests30d: number;
}