/** Role values intentionally match the existing Spring Boot backend ('client' | 'photographer' | 'admin'). */
export type Role = 'client' | 'photographer' | 'admin';
export type Currency = 'MAD' | 'EUR' | 'USD';
export type ISODate = string; // 'YYYY-MM-DD'
export type TimeOfDay = string; // 'HH:mm'
export type ISODateTime = string;

export interface GeoPoint { lat: number; lng: number }
export interface GeoBounds { south: number; west: number; north: number; east: number }

export interface Page<T> { items: T[]; total: number; page: number; pageSize: number }
export interface PageQuery { page: number; pageSize: number; sort?: string; dir?: 'asc' | 'desc'; q?: string }

export type ApiErrorCode =
  | 'VALIDATION' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT'
  | 'RATE_LIMITED' | 'INVALID_CODE' | 'INVALID_RESET_TOKEN' | 'UNAVAILABLE' | 'SLOT_UNAVAILABLE' | 'PRICE_CHANGED' | 'NOT_IMPLEMENTED' | 'NETWORK' | 'SERVER' | 'UNKNOWN';

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status = 400,
    public readonly details?: Record<string, string>,
    /** Seconds to wait before retrying (HTTP 429 / Retry-After). */
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface Category { id: string; slug: string; name: string; icon: string; image: string; featured: boolean }
