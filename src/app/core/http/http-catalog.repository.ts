import { Injectable } from '@angular/core';
import { Observable, forkJoin, map, of } from 'rxjs';
import { AvailabilityRepository, CatalogRepository, PackageHighlight, PhotographerWorkspaceRepository } from '../api/repositories';
import {
  Album, AvailabilityRules, Category, ISODate, LocationInput, Page, PhotographerProfile, PhotographerQuery, PhotographerSummary, PortfolioImage, PromoCode,
  Review, Service, ServicePackage, Slot,
  ProfileCompletion,
} from '../models';
import { useApi } from './api';
import { stripPlaceholders, toParams, withProfileMedia, withSummaryMedia } from './http-util';

/** Public marketplace reads. See docs/ENDPOINTS.md. */
@Injectable()
export class HttpCatalogRepository extends CatalogRepository {
  private api = useApi();
  override categories(): Observable<Category[]> { return this.api.get<Category[]>('/categories'); }
  override search(q: PhotographerQuery): Observable<Page<PhotographerSummary>> {
    const params = toParams({
      q: q.q, city: q.city, lat: q.center?.lat, lng: q.center?.lng, radiusKm: q.radiusKm, categoryId: q.categoryId, minPrice: q.minPrice, maxPrice: q.maxPrice,
      availableOn: q.availableOn, minRating: q.minRating, minExperience: q.minExperience, tier: q.tier, verifiedOnly: q.verifiedOnly || undefined, sort: q.sort, page: q.page, pageSize: q.pageSize,
    });
    return this.api.get<Page<PhotographerSummary>>('/photographers', params).pipe(map(r => ({ ...r, items: r.items.map(withSummaryMedia) })));
  }
  override photographer(id: string): Observable<PhotographerProfile> { return this.api.get<PhotographerProfile>(`/photographers/${enc(id)}`).pipe(map(withProfileMedia)); }
  override similar(id: string): Observable<PhotographerSummary[]> { return this.api.get<PhotographerSummary[]>(`/photographers/${enc(id)}/similar`).pipe(map(l => l.map(withSummaryMedia))); }
  override services(id: string, opts?: { includeUnpublished?: boolean }): Observable<Service[]> {
    return this.api.get<Service[]>(`/photographers/${enc(id)}/services`, toParams({ includeUnpublished: opts?.includeUnpublished || undefined }));
  }
  override packages(id: string, opts?: { includeUnpublished?: boolean }): Observable<ServicePackage[]> {
    return this.api.get<ServicePackage[]>(`/photographers/${enc(id)}/packages`, toParams({ includeUnpublished: opts?.includeUnpublished || undefined }));
  }
  override reviews(id: string): Observable<Review[]> { return this.api.get<Review[]>(`/photographers/${enc(id)}/reviews`); }
  override recordView(id: string): Observable<void> { return this.api.post<void>(`/photographers/${enc(id)}/view`); }
  /** The server accepts up to 50 ids per call; longer lists are fetched in chunks so URLs stay short. */
  override summaries(ids: string[]): Observable<PhotographerSummary[]> {
    const unique = [...new Set(ids)];
    if (!unique.length) return of([]);
    const chunks: string[][] = [];
    for (let i = 0; i < unique.length; i += 40) chunks.push(unique.slice(i, i + 40));
    return forkJoin(chunks.map(c => this.api.get<PhotographerSummary[]>('/photographers/summaries', toParams({ ids: c.join(',') })))).pipe(
      map(parts => parts.flat().map(withSummaryMedia)));
  }
  override bestValuePackages(limit: number): Observable<PackageHighlight[]> {
    return this.api.get<PackageHighlight[]>('/packages/best-value', toParams({ limit })).pipe(map(l => l.map(h => ({ ...h, photographer: withSummaryMedia(h.photographer) }))));
  }
  override siteBanner(): Observable<string> { return this.api.get<{ banner: string }>('/content/banner').pipe(map(r => r.banner ?? '')); }
  override faqs(): Observable<{ id: string; q: string; a: string }[]> { return this.api.get('/content/faq'); }
  override testimonials(limit: number): Observable<Review[]> { return this.api.get<Review[]>('/reviews/featured', toParams({ limit })); }
}

/** The photographer's own workspace: everything under /photographers/me. */
@Injectable()
export class HttpWorkspaceRepository extends PhotographerWorkspaceRepository {
  private api = useApi();
  override myProfile(): Observable<PhotographerProfile> { return this.api.get<PhotographerProfile>('/photographers/me').pipe(map(withProfileMedia)); }
  override updateProfile(patch: Partial<PhotographerProfile>): Observable<PhotographerProfile> {
    return this.api.put<PhotographerProfile>('/photographers/me', stripPlaceholders(patch)).pipe(map(withProfileMedia));
  }
  override submitForApproval(): Observable<PhotographerProfile> { return this.api.post<PhotographerProfile>('/photographers/me/submit').pipe(map(withProfileMedia)); }
  override setLocation(input: LocationInput): Observable<PhotographerProfile> { return this.api.put<PhotographerProfile>('/photographers/me/location', input).pipe(map(withProfileMedia)); }
  override saveService(service: Partial<Service> & { title: string }): Observable<Service> { return this.api.post<Service>('/photographers/me/services', service); }
  override setServiceStatus(id: string, status: Service['status']): Observable<Service> { return this.api.patch<Service>(`/photographers/me/services/${enc(id)}/status`, { status }); }
  override savePackage(pkg: Partial<ServicePackage> & { serviceId: string }): Observable<ServicePackage> { return this.api.post<ServicePackage>('/photographers/me/packages', pkg); }
  override setPackageStatus(id: string, status: ServicePackage['status']): Observable<ServicePackage> { return this.api.patch<ServicePackage>(`/photographers/me/packages/${enc(id)}/status`, { status }); }
  override deletePackage(id: string): Observable<void> { return this.api.delete<void>(`/photographers/me/packages/${enc(id)}`); }
  override savePortfolio(images: PortfolioImage[], albums: Album[]): Observable<void> { return this.api.put<void>('/photographers/me/portfolio', { images, albums }); }
  override completion(): Observable<ProfileCompletion> { return this.api.get<ProfileCompletion>('/photographers/me/completion'); }
  override snoozeCompletion(): Observable<ProfileCompletion> { return this.api.post<ProfileCompletion>('/photographers/me/completion/snooze'); }
  override dismissCompletion(): Observable<ProfileCompletion> { return this.api.post<ProfileCompletion>('/photographers/me/completion/dismiss'); }
  override promoCodes(): Observable<PromoCode[]> { return this.api.get<PromoCode[]>('/photographers/me/promo-codes'); }
  override savePromoCodes(codes: PromoCode[]): Observable<PromoCode[]> { return this.api.put<PromoCode[]>('/photographers/me/promo-codes', codes); }
}

@Injectable()
export class HttpAvailabilityRepository extends AvailabilityRepository {
  private api = useApi();
  override rules(id: string): Observable<AvailabilityRules> { return this.api.get<AvailabilityRules>(`/photographers/${enc(id)}/availability`); }
  override saveRules(rules: AvailabilityRules): Observable<AvailabilityRules> { return this.api.put<AvailabilityRules>('/photographers/me/availability', rules); }
  override slots(id: string, date: ISODate, durationMinutes: number): Observable<Slot[]> {
    return this.api.get<Slot[]>(`/photographers/${enc(id)}/slots`, toParams({ date, duration: durationMinutes }));
  }
  override openDays(id: string, dates: ISODate[], durationMinutes: number): Observable<ISODate[]> {
    return this.api.get<ISODate[]>(`/photographers/${enc(id)}/open-days`, toParams({ dates: dates.join(','), duration: durationMinutes }));
  }
}

const enc = encodeURIComponent;