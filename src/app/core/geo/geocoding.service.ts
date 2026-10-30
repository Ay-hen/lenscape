import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { APP_ENV } from '../config/app-config';
import { GeoPoint } from '../models';
import { CITY_COORDS } from './gazetteer';

export interface GeoResult { label: string; point: GeoPoint; city?: string }

/**
 * Place search + reverse geocoding.
 * Provider is configured in `environment.geocoder`. The public Nominatim server needs NO key but has a strict usage policy
 * (max 1 request/second, identify your app, no bulk use, attribution required) — for production traffic use a hosted
 * provider (MapTiler, LocationIQ, Geoapify…) or self-host Nominatim. See README → Map provider setup.
 */
@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private http = inject(HttpClient);
  private env = inject(APP_ENV).geocoder;

  search(q: string): Observable<GeoResult[]> {
    const query = q.trim(); if (query.length < 2) return of([]);
    const local = this.local(query);
    if (this.env.provider === 'local') return of(local);
    return this.http.get<any[]>(`${this.env.baseUrl}/search`, { params: { q: query, format: 'jsonv2', limit: 6, addressdetails: 1, countrycodes: this.env.countryCodes } }).pipe(
      map(rows => rows.map(r => ({ label: r.display_name as string, point: { lat: +r.lat, lng: +r.lon }, city: r.address?.city ?? r.address?.town ?? r.address?.village }))),
      map(remote => (remote.length ? remote : local)),
      catchError(() => of(local)), // offline / blocked → fall back gracefully
    );
  }

  reverse(p: GeoPoint): Observable<GeoResult | null> {
    const near = this.nearestCity(p);
    if (this.env.provider === 'local') return of(near);
    return this.http.get<any>(`${this.env.baseUrl}/reverse`, { params: { lat: p.lat, lon: p.lng, format: 'jsonv2', zoom: 14 } }).pipe(
      map(r => (r?.display_name ? { label: r.display_name as string, point: p, city: r.address?.city ?? r.address?.town ?? r.address?.village } : near)),
      catchError(() => of(near)),
    );
  }

  private local(q: string): GeoResult[] {
    const t = q.toLowerCase();
    return Object.entries(CITY_COORDS).filter(([n]) => n.toLowerCase().includes(t)).map(([n, p]) => ({ label: `${n}, Morocco`, point: p, city: n }));
  }
  nearestCity(p: GeoPoint): GeoResult | null {
    let best: [string, number] | null = null;
    for (const [n, c] of Object.entries(CITY_COORDS)) { const d = (c.lat - p.lat) ** 2 + (c.lng - p.lng) ** 2; if (!best || d < best[1]) best = [n, d]; }
    return best ? { label: `Near ${best[0]}, Morocco`, point: p, city: best[0] } : null;
  }
}
