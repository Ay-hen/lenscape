import { ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy, afterNextRender, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import type * as Leaflet from 'leaflet';
import { APP_ENV } from '../../core/config/app-config';
import { GeoBounds, GeoPoint, PhotographerSummary } from '../../core/models';
import { pinLabel, priceLabel } from '../../core/util/price';
import { haversineKm } from '../../core/util/geo';
import { CATEGORIES_BY_ID } from '../../core/util/categories';
import { IconComponent } from '../ui/icon.component';
import { RatingComponent } from '../ui/misc';
import { loadLeaflet } from './leaflet-loader';

/** Price-pin map: one marker per photographer, clustered when dense, with a preview card for the selected pin. */
@Component({
  selector: 'app-map-view',
  imports: [RouterLink, IconComponent, RatingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="mv">
    <div #el class="map" role="application" aria-label="Map of photographers with starting prices"></div>
    @if (state() === 'loading') { <div class="ov"><span class="skeleton sk"></span><p>Loading map…</p></div> }
    @if (state() === 'error') { <div class="ov err" role="alert"><app-icon name="alert-triangle" [size]="28" /><p><strong>The map could not be loaded.</strong><br />Check your connection — the list view still works.</p><button class="btn btn--outline btn--sm" type="button" (click)="init()">Retry</button></div> }
    @if (tileError()) { <div class="tile-warn" role="status">Map tiles are not loading — prices and markers are still shown.</div> }
    @if (moved() && searchOnMove()) { <button type="button" class="btn btn--dark here" (click)="searchArea()"><app-icon name="search" [size]="16" />Search this area</button> }
    @if (state() === 'ready' && missing() > 0) { <div class="miss">{{ missing() }} result{{ missing() > 1 ? 's' : '' }} without a map location</div> }
    @if (selectedItem(); as p) {
      <article class="pv fade-in" aria-live="polite">
        <button type="button" class="x" aria-label="Close preview" (click)="selected.emit(null)"><app-icon name="x" [size]="16" /></button>
        <img [src]="p.coverUrl" alt="" />
        <div class="pb"><div class="r1"><img class="av" [src]="p.avatarUrl" alt="" /><div><strong>{{ p.displayName }}</strong><div class="small muted">{{ p.city }}@if (p.distanceKm != null) { · {{ p.distanceKm }} km }</div></div></div>
          <div class="r2"><app-rating [value]="p.rating" [count]="p.reviewCount" /><span class="small muted">{{ spec(p) }}</span></div>
          <div class="r3"><div><span class="xs muted">Starting price</span><br /><strong>{{ price(p) }}</strong></div><a class="btn btn--primary btn--sm" [routerLink]="['/photographers', p.id]">View profile</a></div></div>
      </article>
    }
  </div>`,
  styles: `.mv { position: relative; height: 100%; min-height: 360px; border-radius: inherit; overflow: hidden; } .map { position: absolute; inset: 0; }
  .ov { position: absolute; inset: 0; z-index: 500; display: grid; place-content: center; justify-items: center; gap: 10px; background: var(--c-surface-2); text-align: center; color: var(--c-text-muted); padding: 20px; } .sk { width: 120px; height: 12px; } .err { color: var(--c-error); }
  .tile-warn { position: absolute; z-index: 700; top: 10px; left: 50%; transform: translateX(-50%); background: var(--c-warning-bg); color: var(--c-warning); font-size: 12px; padding: 6px 12px; border-radius: 99px; box-shadow: var(--shadow-1); }
  .here { position: absolute; z-index: 700; top: 12px; left: 50%; transform: translateX(-50%); box-shadow: var(--shadow-3); } .miss { position: absolute; z-index: 600; left: 10px; bottom: 10px; background: var(--c-surface); color: var(--c-text-muted); font-size: 12px; padding: 4px 10px; border-radius: 99px; box-shadow: var(--shadow-1); }
  .pv { position: absolute; z-index: 800; left: 12px; right: 12px; bottom: 12px; max-width: 380px; display: flex; background: var(--c-surface); border-radius: 16px; box-shadow: var(--shadow-3); overflow: hidden; border: 1px solid var(--c-border); } .pv > img { width: 112px; object-fit: cover; flex: none; } .pb { padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 0; }
  .x { position: absolute; top: 6px; right: 6px; width: 28px; height: 28px; border-radius: 50%; border: 0; background: rgb(255 255 255 / 90%); color: #0f172a; cursor: pointer; display: grid; place-items: center; box-shadow: var(--shadow-1); } .r1 { display: flex; gap: 10px; align-items: center; padding-right: 22px; } .av { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; }
  .r2 { display: flex; gap: 10px; align-items: center; justify-content: space-between; } .r3 { display: flex; justify-content: space-between; align-items: flex-end; } .r3 strong { font-size: 1.05rem; }`,
})
export class MapViewComponent implements OnDestroy {
  readonly items = input.required<PhotographerSummary[]>(); readonly selectedId = input<string | null>(null); readonly center = input<GeoPoint | null>(null); readonly radiusKm = input<number | null>(null);
  readonly fitKey = input<string>(''); readonly searchOnMove = input(true);
  readonly selected = output<string | null>(); readonly areaSearch = output<{ center: GeoPoint; radiusKm: number; bounds: GeoBounds }>();

  private env = inject(APP_ENV).map; private zone = inject(NgZone);
  private el = viewChild.required<ElementRef<HTMLElement>>('el');
  readonly state = signal<'loading' | 'ready' | 'error'>('loading'); readonly tileError = signal(false); readonly moved = signal(false); readonly missing = signal(0);
  readonly selectedItem = () => this.items().find(i => i.id === this.selectedId()) ?? null;

  private L?: typeof Leaflet; private map?: Leaflet.Map; private cluster?: Leaflet.MarkerClusterGroup; private me?: Leaflet.Layer; private circle?: Leaflet.Circle;
  private markers = new Map<string, Leaflet.Marker>(); private programmatic = false; private lastFit = '';

  constructor() {
    afterNextRender(() => this.init());
    effect(() => { const items = this.items(); const sel = this.selectedId(); const key = this.fitKey(); if (this.map) this.render(items, sel, key); });
    effect(() => { const c = this.center(); const r = this.radiusKm(); if (this.map) this.drawCenter(c, r); });
  }
  ngOnDestroy() { this.map?.remove(); }

  spec(p: PhotographerSummary) { return p.specialties.slice(0, 2).map(s => CATEGORIES_BY_ID[s] ?? s).join(' · '); }
  price(p: PhotographerSummary) { return priceLabel(p.startingPrice); }

  async init() {
    this.state.set('loading');
    try {
      const L = await loadLeaflet(); this.L = L;
      this.map?.remove();
      this.map = L.map(this.el().nativeElement, { zoomControl: true, attributionControl: true, center: this.env.defaultCenter, zoom: this.env.defaultZoom, worldCopyJump: true });
      const tiles = L.tileLayer(this.env.tileUrl, { attribution: this.env.attribution, maxZoom: this.env.maxZoom });
      let errs = 0; tiles.on('tileerror', () => { if (++errs > 3) this.zone.run(() => this.tileError.set(true)); }); tiles.on('tileload', () => { if (this.tileError()) this.zone.run(() => this.tileError.set(false)); });
      tiles.addTo(this.map);
      this.cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 48, iconCreateFunction: c => L.divIcon({ html: `<span>${c.getChildCount()}</span>`, className: 'marker-cluster-custom', iconSize: [40, 40] }) });
      this.map.addLayer(this.cluster);
      this.map.on('dragend zoomend', () => { if (!this.programmatic) this.zone.run(() => this.moved.set(true)); });
      this.map.on('click', () => this.zone.run(() => this.selected.emit(null)));
      this.state.set('ready');
      this.render(this.items(), this.selectedId(), this.fitKey()); this.drawCenter(this.center(), this.radiusKm());
      setTimeout(() => this.map?.invalidateSize(), 0);
    } catch { this.state.set('error'); }
  }

  private render(items: PhotographerSummary[], sel: string | null, key: string) {
    const L = this.L, map = this.map, cluster = this.cluster; if (!L || !map || !cluster) return;
    const valid = items.filter(i => Number.isFinite(i.location?.lat) && Number.isFinite(i.location?.lng)); this.missing.set(items.length - valid.length);
    const ids = new Set(valid.map(i => i.id));
    for (const [id, m] of this.markers) if (!ids.has(id)) { cluster.removeLayer(m); this.markers.delete(id); }
    for (const p of valid) {
      const html = `<div class="price-pin__bubble${p.id === sel ? ' is-active' : ''}${p.identityVerified ? ' is-verified' : ''}${p.availableOnDate === false ? ' is-unavailable' : ''}" title="${p.displayName.replace(/"/g, '')}">${pinLabel(p.startingPrice)}${p.startingPrice.label === 'quote' ? '' : ' <small>MAD</small>'}</div>`;
      const icon = L.divIcon({ html, className: 'price-pin', iconSize: [0, 0] });
      let m = this.markers.get(p.id);
      if (!m) { m = L.marker([p.location.lat, p.location.lng], { icon, keyboard: true, title: `${p.displayName}, ${priceLabel(p.startingPrice)}`, riseOnHover: true }); m.on('click', (e: Leaflet.LeafletMouseEvent) => { L.DomEvent.stopPropagation(e); this.zone.run(() => this.selected.emit(p.id)); }); this.markers.set(p.id, m); cluster.addLayer(m); }
      else { m.setIcon(icon); m.setLatLng([p.location.lat, p.location.lng]); }
      m.setZIndexOffset(p.id === sel ? 1000 : 0);
    }
    if (key !== this.lastFit) { this.lastFit = key; this.fit(valid); }
    if (sel) { const m = this.markers.get(sel); const parent = m ? cluster.getVisibleParent(m) : null; if (m && parent && parent !== m) { this.programmatic = true; cluster.zoomToShowLayer(m, () => (this.programmatic = false)); } }
  }
  private fit(valid: PhotographerSummary[]) {
    const L = this.L!, map = this.map!; this.programmatic = true; this.moved.set(false);
    const c = this.center(); const pts: Leaflet.LatLngExpression[] = valid.map(p => [p.location.lat, p.location.lng]); if (c) pts.push([c.lat, c.lng]);
    if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [56, 56], maxZoom: 14, animate: true }); else if (pts.length === 1) map.setView(pts[0], 13); else map.setView(this.env.defaultCenter, this.env.defaultZoom);
    setTimeout(() => (this.programmatic = false), 600);
  }
  private drawCenter(c: GeoPoint | null, r: number | null) {
    const L = this.L, map = this.map; if (!L || !map) return; if (this.me) map.removeLayer(this.me); if (this.circle) map.removeLayer(this.circle); this.me = undefined; this.circle = undefined;
    if (!c) return;
    this.me = L.marker([c.lat, c.lng], { icon: L.divIcon({ className: '', html: '<div class="me-pin"></div>', iconSize: [16, 16] }), interactive: false, keyboard: false }).addTo(map);
    if (r) this.circle = L.circle([c.lat, c.lng], { radius: r * 1000, color: '#245b94', weight: 1.5, fillOpacity: 0.05, interactive: false }).addTo(map);
  }
  searchArea() {
    const map = this.map; if (!map) return; const b = map.getBounds(); const c = map.getCenter();
    const radius = Math.max(1, Math.min(250, Math.round(haversineKm({ lat: c.lat, lng: c.lng }, { lat: b.getNorth(), lng: b.getEast() }) / 1.4)));
    this.moved.set(false); this.areaSearch.emit({ center: { lat: c.lat, lng: c.lng }, radiusKm: radius, bounds: { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() } });
  }
}
