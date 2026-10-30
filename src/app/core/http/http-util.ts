import { HttpParams } from '@angular/common/http';
import { avatarImage, sceneImage } from '../util/images';
import { PhotographerProfile, PhotographerSummary, Application, Booking } from '../models';

/** Builds query params, skipping undefined / null / empty values (so optional filters never reach the URL). */
export function toParams(o: Record<string, string | number | boolean | undefined | null>): HttpParams {
  let p = new HttpParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
  return p;
}

/**
 * Photographers who have not uploaded an avatar / cover yet get a generated, clearly abstract placeholder image
 * (initials / soft gradients). This is presentation only: nothing is written back to the server, and no photographer data is invented.
 */
export const isPlaceholder = (url: string | undefined): boolean => !url || url.startsWith('data:image/svg+xml');

export function withProfileMedia(p: PhotographerProfile): PhotographerProfile {
  return { ...p, avatarUrl: p.avatarUrl || avatarImage(p.displayName ?? ''), coverUrl: p.coverUrl || sceneImage(p.id) };
}
export function withSummaryMedia(p: PhotographerSummary): PhotographerSummary {
  return { ...p, avatarUrl: p.avatarUrl || avatarImage(p.displayName ?? ''), coverUrl: p.coverUrl || sceneImage(p.id) };
}
export function withApplicationMedia(a: Application): Application { return { ...a, avatarUrl: a.avatarUrl || avatarImage(a.displayName ?? '') }; }
export function withBookingMedia(b: Booking): Booking { return { ...b, photographerAvatar: b.photographerAvatar || avatarImage(b.photographerName ?? '') }; }

/** Never send generated placeholders back to the server as if they were uploads. */
export function stripPlaceholders<T extends { avatarUrl?: string; coverUrl?: string }>(patch: T): T {
  const out = { ...patch };
  if (isPlaceholder(out.avatarUrl) && out.avatarUrl !== undefined) out.avatarUrl = '';
  if (isPlaceholder(out.coverUrl) && out.coverUrl !== undefined) out.coverUrl = '';
  return out;
}
