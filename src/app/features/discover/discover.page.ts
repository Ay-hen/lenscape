import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { CatalogRepository } from '../../core/api/repositories';
import { GeoPoint, PackageTier, PhotographerQuery, PhotographerSort, PhotographerSummary } from '../../core/models';
import { GeoResult } from '../../core/geo/geocoding.service';
import { CompareStore, SavedSearchStore } from '../../core/state/stores';
import { SeoService } from '../../core/seo.service';
import { todayISO } from '../../core/util/dates';
import { priceLabel } from '../../core/util/price';
import { CATEGORIES_BY_ID } from '../../core/util/categories';
import { PhotographerCardComponent } from '../../shared/cards/photographer-card.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { ModalComponent } from '../../shared/ui/modal.component';
import { EmptyStateComponent, ErrorStateComponent, PaginationComponent, RatingComponent } from '../../shared/ui/misc';
import { LocationSearchComponent } from '../../shared/map/location-search.component';
import { MapViewComponent } from '../../shared/map/map-view.component';
import { ToastService } from '../../shared/services/overlay.services';

const PAGE_SIZE = 9;
type View = 'list' | 'map';

@Component({
  selector: 'app-discover',
  imports: [FormsModule, RouterLink, IconComponent, PhotographerCardComponent, MapViewComponent, LocationSearchComponent, ModalComponent, EmptyStateComponent, ErrorStateComponent, PaginationComponent, RatingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './discover.page.html',
  styleUrl: './discover.page.scss',
})
export class DiscoverPage {
  private repo = inject(CatalogRepository); private router = inject(Router); private route = inject(ActivatedRoute); private toast = inject(ToastService);
  readonly compare = inject(CompareStore); readonly saved = inject(SavedSearchStore);
  readonly today = todayISO(); readonly pageSize = PAGE_SIZE; readonly cat = CATEGORIES_BY_ID;
  readonly tiers: PackageTier[] = ['bronze', 'silver', 'gold', 'platinum'];

  private qp = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  /** The URL is the single source of truth, so searches are shareable, bookmarkable and back-button friendly. */
  readonly query = computed<PhotographerQuery>(() => {
    const m = this.qp(); const num = (k: string) => (m.get(k) !== null && m.get(k) !== '' && !isNaN(+m.get(k)!) ? +m.get(k)! : undefined);
    const lat = num('lat'), lng = num('lng');
    return {
      q: m.get('q') ?? undefined, categoryId: m.get('category') ?? undefined, availableOn: m.get('date') ?? undefined, minPrice: num('min'), maxPrice: num('max'), minRating: num('rating'), minExperience: num('exp'),
      tier: (m.get('tier') as PackageTier) ?? undefined, verifiedOnly: m.get('verified') === '1', center: lat != null && lng != null ? { lat, lng } : undefined, radiusKm: num('radius'),
      sort: (m.get('sort') as PhotographerSort) ?? (lat != null ? 'nearest' : 'recommended'), page: num('page') ?? 1, pageSize: PAGE_SIZE,
    };
  });
  readonly view = computed<View>(() => (this.qp().get('view') === 'map' ? 'map' : 'list'));
  readonly center = computed<GeoPoint | null>(() => this.query().center ?? null);
  readonly radius = computed(() => this.query().radiusKm ?? null);

  readonly list = rxResource({ params: () => this.query(), stream: ({ params }) => this.repo.search(params) });
  /** The map shows every match (not just the current page) so markers always agree with the filters. */
  readonly mapData = rxResource({ params: () => (this.view() === 'map' ? { ...this.query(), page: 1, pageSize: 200 } : null), stream: ({ params }) => (params ? this.repo.search(params) : of({ items: [], total: 0, page: 1, pageSize: 200 })) });
  readonly categories = toSignal(this.repo.categories(), { initialValue: [] });

  readonly selectedId = signal<string | null>(null); readonly filtersOpen = signal(false); readonly compareOpen = signal(false); readonly hoverId = signal<string | null>(null);
  readonly draft = signal<{ min: string; max: string; rating: string; exp: string; tier: string; verified: boolean; radius: string }>({ min: '', max: '', rating: '', exp: '', tier: '', verified: false, radius: '' });
  readonly qText = signal(this.route.snapshot.queryParamMap.get('q') ?? '');
  readonly mapItems = computed(() => this.mapData.value()?.items ?? []);
  readonly fitKey = computed(() => { const q = this.query(); return JSON.stringify({ ...q, page: 0, sort: '' }) + this.mapItems().length; });

  readonly activeFilters = computed(() => {
    const q = this.query(); const out: { key: string[]; label: string }[] = [];
    if (q.q) out.push({ key: ['q'], label: `“${q.q}”` }); if (q.categoryId) out.push({ key: ['category'], label: this.cat[q.categoryId] ?? q.categoryId }); if (q.availableOn) out.push({ key: ['date'], label: `Available ${q.availableOn}` });
    if (q.minPrice != null || q.maxPrice != null) out.push({ key: ['min', 'max'], label: `${q.minPrice ?? 0}–${q.maxPrice ?? '∞'} MAD` }); if (q.minRating) out.push({ key: ['rating'], label: `${q.minRating}+ rating` });
    if (q.minExperience) out.push({ key: ['exp'], label: `${q.minExperience}+ yrs` }); if (q.tier) out.push({ key: ['tier'], label: `${q.tier} package` }); if (q.verifiedOnly) out.push({ key: ['verified'], label: 'Identity verified' });
    if (q.center) out.push({ key: ['lat', 'lng', 'radius'], label: q.radiusKm ? `Within ${q.radiusKm} km` : 'Near selected place' });
    return out;
  });

  constructor() {
    inject(SeoService).set('Find photographers', 'Search photographers by location, price, availability and rating. Compare packages and book online.');
    const q = this.query(); this.draft.set({ min: q.minPrice?.toString() ?? '', max: q.maxPrice?.toString() ?? '', rating: q.minRating?.toString() ?? '', exp: q.minExperience?.toString() ?? '', tier: q.tier ?? '', verified: !!q.verifiedOnly, radius: q.radiusKm?.toString() ?? '' });
  }

  nav(patch: Record<string, string | number | null | undefined>, resetPage = true) {
    const params: Record<string, string | number | null | undefined> = { ...patch }; if (resetPage && !('page' in patch)) params['page'] = null;
    void this.router.navigate([], { relativeTo: this.route, queryParams: Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v === '' || v === undefined ? null : v])), queryParamsHandling: 'merge' });
  }
  submitText() { this.nav({ q: this.qText().trim() || null }); }
  setView(v: View) { this.nav({ view: v === 'map' ? 'map' : null }, false); this.selectedId.set(null); }
  setSort(s: string) { this.nav({ sort: s }); }
  applyFilters() { const d = this.draft(); this.nav({ min: d.min, max: d.max, rating: d.rating, exp: d.exp, tier: d.tier, verified: d.verified ? 1 : null, radius: this.center() ? d.radius : null }); this.filtersOpen.set(false); }
  patchDraft(k: string, v: string | boolean) { this.draft.update(d => ({ ...d, [k]: v })); }
  clear(keys: string[]) { this.nav(Object.fromEntries(keys.map(k => [k, null]))); const q = this.query(); void q; if (keys.includes('q')) this.qText.set(''); if (keys.includes('min')) this.draft.update(d => ({ ...d, min: '', max: '' })); }
  resetAll() { this.qText.set(''); this.draft.set({ min: '', max: '', rating: '', exp: '', tier: '', verified: false, radius: '' }); void this.router.navigate([], { relativeTo: this.route, queryParams: { view: this.view() === 'map' ? 'map' : null } }); }
  placePicked(r: GeoResult) { this.nav({ lat: r.point.lat.toFixed(5), lng: r.point.lng.toFixed(5), radius: this.radius() ?? 25, sort: 'nearest' }); this.toast.info(`Showing photographers near ${r.city ?? r.label.split(',')[0]}`); }
  areaSearch(e: { center: GeoPoint; radiusKm: number }) { this.nav({ lat: e.center.lat.toFixed(5), lng: e.center.lng.toFixed(5), radius: e.radiusKm, sort: 'nearest' }); }
  saveSearch() { const q = this.activeFilters().map(f => f.label).join(', ') || 'All photographers'; const params: Record<string, string> = {}; this.qp().keys.forEach(k => { if (k !== 'page') params[k] = this.qp().get(k)!; }); this.saved.add(q, params); this.toast.success('Search saved on this device.'); }
  runSaved(s: { query: Record<string, string> }) { void this.router.navigate([], { relativeTo: this.route, queryParams: s.query }); }
  toggleCompare(p: PhotographerSummary) { if (!this.compare.toggle(p)) this.toast.info('You can compare up to 3 photographers.'); }
  priceText(p: PhotographerSummary) { return priceLabel(p.startingPrice); }
  focusCard(id: string | null) { this.selectedId.set(id); if (id) queueMicrotask(() => document.getElementById('card-' + id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })); }
}
