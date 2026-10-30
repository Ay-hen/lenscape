import { GeoPoint } from '../models';

const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

/** Straight-line (great-circle) distance. NOT a driving distance — never present it as travel time. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Deterministic privacy offset (≈ up to 400 m) so a precise address is never published. */
export function approximate(p: GeoPoint, seed: string): GeoPoint {
  let h = 0; for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  const a = ((h & 0xffff) / 0xffff) * Math.PI * 2;
  const r = 0.0015 + (((h >>> 16) & 0xff) / 0xff) * 0.002;
  return { lat: p.lat + Math.sin(a) * r, lng: p.lng + Math.cos(a) * r };
}

export const MOROCCO_CENTER: GeoPoint = { lat: 31.79, lng: -7.09 };
