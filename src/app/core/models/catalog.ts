import { Currency, GeoPoint, ISODateTime } from './common';

export type PricingModel = 'fixed' | 'hourly' | 'starting' | 'quote';
export type PackageTier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type PublishStatus = 'draft' | 'published' | 'archived';
export type ModerationState = 'ok' | 'reported' | 'hidden';

export interface AddOn { id: string; name: string; price: number; description?: string }

export interface ServicePackage {
  id: string;
  serviceId: string;
  photographerId: string;
  name: string;
  tier: PackageTier;
  /** Meaning depends on `pricingModel` of the parent service: fixed price, hourly rate, or starting price. */
  price: number | null;
  currency: Currency;
  description: string;
  durationMinutes: number;
  editedPhotos: number;
  locations: number;
  outfitChanges: number;
  deliveryDays: number;
  includes: string[];
  extras: string[];
  travelConditions: string;
  bookingConditions: string;
  featured: boolean;
  status: PublishStatus;
}

export interface Service {
  id: string;
  photographerId: string;
  title: string;
  description: string;
  categoryId: string;
  coverImage: string;
  gallery: string[];
  pricingModel: PricingModel;
  basePrice: number | null; // null for custom quote
  currency: Currency;
  durationMinutes: number;
  deliverables: string[];
  editedPhotos: number;
  deliveryDays: number;
  travelRules: string;
  addOns: AddOn[];
  status: PublishStatus;
  moderation: ModerationState;
  featured: boolean;
  updatedAt: ISODateTime;
}

/** What the marketplace shows as "starting price" — never conflates fixed / hourly / quote. */
export interface PriceInfo {
  amount: number | null;
  currency: Currency;
  model: PricingModel;
  /** 'from' = lowest fixed/starting package, 'per_hour' = hourly rate, 'quote' = custom */
  label: 'from' | 'fixed' | 'per_hour' | 'quote';
}

export interface PortfolioImage {
  id: string;
  url: string;
  caption: string;
  categoryId: string;
  albumId?: string;
  order: number;
  visible: boolean;
  isCover: boolean;
}
export interface Album { id: string; name: string; order: number; visible: boolean }

export interface PromoCode { id: string; code: string; percent: number; active: boolean; expiresAt?: string; uses: number; maxUses?: number }
