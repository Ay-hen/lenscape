import { GeoPoint, ISODate, ISODateTime, TimeOfDay } from './common';
import { Album, PackageTier, PortfolioImage, PriceInfo } from './catalog';

/** approval ≠ identity verification. Only `identityVerified` may show a "Verified identity" badge. */
export type ApprovalStatus = 'draft' | 'pending' | 'needs_info' | 'approved' | 'rejected';

export interface CancellationPolicy {
  freeCancelHours: number;
  partialRefundPercent: number;
  partialRefundHours: number;
  summary: string;
}

/**
 * How the photographer works.
 *  - 'freelancer': no shop. Only the CITY is chosen; the map shows an approximate position inside that city, never an exact spot.
 *  - 'shop': has a physical shop/studio. Its EXACT coordinates are required and shown publicly so customers can find it.
 */
export type WorkMode = 'freelancer' | 'shop';

export type GearKind = 'camera' | 'lens' | 'video' | 'drone' | 'lighting' | 'audio' | 'accessory';
export interface GearItem { kind: GearKind; name: string }

/** Payload of PUT /photographers/me/location. `point` is REQUIRED for 'shop' and IGNORED for 'freelancer' (the server derives an approximate point from the city). */
export interface LocationInput {
  workMode: WorkMode;
  city: string;
  radiusKm: number;
  point?: GeoPoint;
  shopAddress?: string;
}

export interface PhotographerProfile {
  id: string;
  userId: string;
  displayName: string;
  businessName?: string;
  headline: string;
  bio: string;
  avatarUrl: string;
  coverUrl: string;
  city: string;
  neighborhood?: string;
  workMode: WorkMode;
  /** Street address of the shop. Only meaningful (and only public) when workMode is 'shop'. */
  shopAddress?: string;
  /** PUBLIC marketplace position: the exact shop for workMode 'shop', an approximate point inside the city for 'freelancer'. A freelancer's home address is never part of this model. */
  publicLocation: GeoPoint;
  serviceRadiusKm: number;
  languages: string[];
  /** What the photographer shoots with. Only shown on the public profile when `showGear` is true. */
  gear: GearItem[];
  showGear: boolean;
  specialties: string[]; // category ids
  yearsExperience: number;
  rating: number;
  reviewCount: number;
  completedBookings: number;
  responseTimeHours: number;
  approval: ApprovalStatus;
  identityVerified: boolean;
  cancellationPolicy: CancellationPolicy;
  policies: string[];
  favoritesCount: number;
  profileViews: number;
  joinedAt: ISODateTime;
  featured: boolean;
  phone?: string;
  portfolio: PortfolioImage[];
  albums: Album[];
  onboardingStep: number;
}

export interface CompletionItem { key: string; label: string; weight: number; done: boolean; link: string }
export interface ProfileCompletion { percent: number; items: CompletionItem[]; dismissThreshold: number; canDismiss: boolean; dismissed: boolean; snoozedUntil?: string; showReminder: boolean }

export interface PhotographerSummary {
  id: string;
  displayName: string;
  avatarUrl: string;
  coverUrl: string;
  city: string;
  workMode: WorkMode;
  headline: string;
  rating: number;
  reviewCount: number;
  specialties: string[];
  yearsExperience: number;
  startingPrice: PriceInfo;
  tiers: PackageTier[];
  location: GeoPoint;
  distanceKm?: number;
  availableOnDate?: boolean;
  nextAvailable?: ISODate;
  identityVerified: boolean;
  featured: boolean;
  popularity: number;
  serviceRadiusKm: number;
}

export type PhotographerSort = 'recommended' | 'nearest' | 'price_asc' | 'price_desc' | 'rating' | 'popular';

export interface PhotographerQuery {
  q?: string;
  city?: string;
  center?: GeoPoint;
  radiusKm?: number;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  availableOn?: ISODate;
  minRating?: number;
  minExperience?: number;
  tier?: PackageTier;
  verifiedOnly?: boolean;
  sort: PhotographerSort;
  page: number;
  pageSize: number;
}

export interface TimeRange { start: TimeOfDay; end: TimeOfDay }
export interface DayHours { enabled: boolean; ranges: TimeRange[] }
export interface BlockedRange { id: string; start: ISODate; end: ISODate; reason: string }
export interface DateException { date: ISODate; ranges: TimeRange[]; note?: string }

export interface AvailabilityRules {
  photographerId: string;
  /** index 0 = Sunday … 6 = Saturday (JS Date.getDay()) */
  weekly: DayHours[];
  slotStepMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minNoticeHours: number;
  maxAdvanceDays: number;
  blockedDates: BlockedRange[];
  exceptions: DateException[];
}

export interface Slot { start: TimeOfDay; end: TimeOfDay; available: boolean; reason?: 'booked' | 'past' | 'notice' | 'blocked' }

export interface Review {
  id: string;
  bookingId: string;
  photographerId: string;
  customerId: string;
  customerName: string;
  rating: number;
  comment: string;
  createdAt: ISODateTime;
  reply?: string;
  /** Filled in by the server for the home-page testimonials. */
  photographerName?: string;
  serviceTitle?: string;
}