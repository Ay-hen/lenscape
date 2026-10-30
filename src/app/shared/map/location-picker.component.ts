import { ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy, afterNextRender, effect, inject, input, output, signal, viewChild } from '@angular/core';
import type * as Leaflet from 'leaflet';
import { APP_ENV } from '../../core/config/app-config';
import { GeoPoint } from '../../core/models';
import { IconComponent } from '../ui/icon.component';
import { loadLeaflet } from './leaflet-loader';

/** Map with a draggable marker (click the map or drag the pin) and an optional service-radius circle. */
@Component({
  selector: 'app-location-picker',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="lp"><div #el class="map" [style.height.px]="height()" role="application" aria-label="Location picker. Click the map or drag the pin to set the location."></div>
    @if (state() === 'loading') { <div class="ov">Loading map…</div> } @if (state() === 'error') { <div class="ov err" role="alert"><app-icon name="alert-triangle" /> Map failed to load. <button type="button" class="link-btn" (click)="init()">Retry</button><br /><span class="small">You can still enter coordinates manually.</span></div> }</div>`,
  styles: `.lp { position: relative; border-radius: 14px; overflow: hidden; border: 1px solid var(--c-border); } .map { width: 100%; } .ov { position: absolute; inset: 0; z-index: 500; display: grid; place-content: center; text-align: center; background: var(--c-surface-2); color: var(--c-text-muted); padding: 16px; } .err { color: var(--c-error); }`,
})
export class LocationPickerComponent implements OnDestroy {
  readonly point = input.required<GeoPoint>(); readonly radiusKm = input<number | null>(null); readonly height = input(340); readonly zoom = input(12);
  readonly pointChange = output<GeoPoint>();
  private env = inject(APP_ENV).map; private zone = inject(NgZone);
  private el = viewChild.required<ElementRef<HTMLElement>>('el');
  readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  private L?: typeof Leaflet; private map?: Leaflet.Map; private marker?: Leaflet.Marker; private circle?: Leaflet.Circle; private lastR: number | null | undefined;

  constructor() {
    afterNextRender(() => this.init());
    effect(() => { const p = this.point(); const r = this.radiusKm(); if (this.map) this.sync(p, r); });
  }
  ngOnDestroy() { this.map?.remove(); }

  async init() {
    this.state.set('loading');
    try {
      const L = await loadLeaflet(); this.L = L; this.map?.remove(); const p = this.point();
      this.map = L.map(this.el().nativeElement, { center: [p.lat, p.lng], zoom: this.zoom() });
      L.tileLayer(this.env.tileUrl, { attribution: this.env.attribution, maxZoom: this.env.maxZoom }).addTo(this.map);
      this.marker = L.marker([p.lat, p.lng], { draggable: true, keyboard: true, title: 'Drag to set location', icon: L.divIcon({ className: 'price-pin', html: '<div class="price-pin__bubble is-active">📍 Your location</div>', iconSize: [0, 0] }) }).addTo(this.map);
      this.marker.on('dragend', () => { const ll = this.marker!.getLatLng(); this.zone.run(() => this.pointChange.emit({ lat: +ll.lat.toFixed(6), lng: +ll.lng.toFixed(6) })); });
      this.map.on('click', (e: Leaflet.LeafletMouseEvent) => this.zone.run(() => this.pointChange.emit({ lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) })));
      this.state.set('ready'); this.sync(p, this.radiusKm(), true); setTimeout(() => this.map?.invalidateSize(), 0);
    } catch { this.state.set('error'); }
  }
  private sync(p: GeoPoint, r: number | null, first = false) {
    const L = this.L, map = this.map, m = this.marker; if (!L || !map || !m) return;
    m.setLatLng([p.lat, p.lng]); if (this.circle) { map.removeLayer(this.circle); this.circle = undefined; }
    const radiusChanged = r !== this.lastR; this.lastR = r;
    if (r) { this.circle = L.circle([p.lat, p.lng], { radius: r * 1000, color: '#2563eb', weight: 1.5, fillOpacity: 0.08, interactive: false }).addTo(map); if (first || radiusChanged) map.fitBounds(this.circle.getBounds(), { padding: [20, 20], maxZoom: 14, animate: !first }); else map.panTo([p.lat, p.lng]); }
    else map.panTo([p.lat, p.lng]);
  }
}
