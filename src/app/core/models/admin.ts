import { ISODate, ISODateTime } from './common';
import { ApprovalStatus } from './photographer';
import { Currency } from './common';

export interface ApprovalEvent { at: ISODateTime; actor: string; action: 'submitted' | 'approved' | 'rejected' | 'info_requested' | 'resubmitted' | 'identity_verified'; note?: string }
export interface Application {
  photographerId: string;
  displayName: string;
  email: string;
  city: string;
  avatarUrl: string;
  status: ApprovalStatus;
  identityVerified: boolean;
  submittedAt: ISODateTime;
  portfolioSamples: string[];
  specialties: string[];
  history: ApprovalEvent[];
  internalNote?: string;
}

export interface AuditEntry { id: string; at: ISODateTime; actor: string; action: string; target: string; detail?: string }

export type ReportTargetType = 'profile' | 'service' | 'review' | 'account';
export interface ContentReport { id: string; targetType: ReportTargetType; targetId: string; targetLabel: string; reason: string; reportedBy: string; at: ISODateTime; state: 'open' | 'dismissed' | 'actioned' }

export interface PlatformSettings {
  brandName: string;
  tagline: string;
  currency: Currency;
  locale: string;
  commissionPercent: number;
  defaultFreeCancelHours: number;
  defaultMinNoticeHours: number;
  categories: { id: string; name: string; featured: boolean }[];
  faqs: { id: string; q: string; a: string }[];
  notificationTemplates: { id: string; name: string; body: string }[];
  featuredPhotographerIds: string[];
  maintenanceBanner: string;
}

export interface TimePoint { label: string; value: number }
export interface Series { name: string; points: TimePoint[] }

export interface AdminOverview {
  totalCustomers: number;
  totalPhotographers: number;
  pendingApprovals: number;
  activeServices: number;
  publishedPackages: number;
  totalBookings: number;
  upcomingBookings: number;
  cancellationRate: number;
  grossBookingValue: number;
  platformRevenue: number;
  currency: Currency;
  customerGrowth: Series;
  photographerGrowth: Series;
  bookingTrend: Series;
  topCategories: TimePoint[];
  recentActivity: AuditEntry[];
  openReports: number;
  openDisputes: number;
}

export interface DateRange { from: ISODate; to: ISODate }
