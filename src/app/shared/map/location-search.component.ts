import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { GeoResult, GeocodingService } from '../../core/geo/geocoding.service';
import { IconComponent } from '../ui/icon.component';

/** Place autocomplete + "use my location". Geolocation is requested ONLY when the user clicks the button. */
@Component({
  selector: 'app-location-search',
  imports: [FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="ls">
    <div class="in"><app-icon name="search" [size]="16" /><input class="input" type="search" role="combobox" aria-autocomplete="list" [attr.aria-expanded]="open()" aria-controls="ls-list" [placeholder]="placeholder()" [attr.aria-label]="label()" autocomplete="off"
      [ngModel]="text()" [ngModelOptions]="{ standalone: true }" (ngModelChange)="type($event)" (keydown.escape)="open.set(false)" (focus)="open.set(results().length > 0)" />
      @if (locate()) { <button type="button" class="btn btn--sm btn--outline gps" (click)="useMyLocation()" [disabled]="locating()"><app-icon name="locate-fixed" [size]="14" />{{ locating() ? 'Locating…' : 'My location' }}</button> }</div>
    @if (open() && results().length) { <ul id="ls-list" class="list" role="listbox">@for (r of results(); track r.label) { <li role="option" tabindex="0" (click)="pick(r)" (keydown.enter)="pick(r)"><app-icon name="map-pin" [size]="14" />{{ r.label }}</li> }</ul> }
    @if (message()) { <p class="msg" role="status">{{ message() }}</p> }
  </div>`,
  styles: `.ls { position: relative; } .in { position: relative; display: flex; gap: 8px; align-items: center; } .in > app-icon { position: absolute; left: 12px; color: var(--c-text-subtle); z-index: 1; } .input { padding-left: 36px; } .gps { flex: none; }
  .list { position: absolute; z-index: 1200; top: calc(100% + 4px); left: 0; right: 0; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 12px; box-shadow: var(--shadow-3); overflow: hidden; max-height: 260px; overflow-y: auto; } .list li { display: flex; gap: 8px; align-items: center; padding: 10px 14px; font-size: 14px; cursor: pointer; } .list li:hover, .list li:focus { background: var(--c-surface-2); outline: none; }
  .msg { font-size: 12px; color: var(--c-warning); margin-top: 6px; }`,
})
export class LocationSearchComponent {
  readonly placeholder = input('Search a city or address'); readonly label = input('Search location'); readonly locate = input(true); readonly initial = input('');
  readonly picked = output<GeoResult>();
  private geo = inject(GeocodingService); private destroyRef = inject(DestroyRef);
  readonly text = signal(''); readonly results = signal<GeoResult[]>([]); readonly open = signal(false); readonly locating = signal(false); readonly message = signal('');
  private q$ = new Subject<string>();
  constructor() {
    this.q$.pipe(debounceTime(350), distinctUntilChanged(), switchMap(q => this.geo.search(q)), takeUntilDestroyed(this.destroyRef)).subscribe(r => { this.results.set(r); this.open.set(r.length > 0); });
    queueMicrotask(() => this.text.set(this.initial()));
  }
  type(v: string) { this.text.set(v); this.message.set(''); this.q$.next(v); }
  pick(r: GeoResult) { this.text.set(r.label.split(',').slice(0, 2).join(',')); this.open.set(false); this.picked.emit(r); }
  useMyLocation() {
    if (!('geolocation' in navigator)) { this.message.set('Your browser does not support location. Search for a place instead.'); return; }
    this.locating.set(true); this.message.set('');
    navigator.geolocation.getCurrentPosition(
      pos => { this.locating.set(false); const p = { lat: pos.coords.latitude, lng: pos.coords.longitude }; this.geo.reverse(p).subscribe(r => this.picked.emit(r ?? { label: 'My location', point: p })); this.text.set('My location'); },
      err => { this.locating.set(false); this.message.set(err.code === err.PERMISSION_DENIED ? 'Location permission was denied. You can still search for a place or click the map.' : 'Could not determine your location. Try searching for a place instead.'); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }
}
