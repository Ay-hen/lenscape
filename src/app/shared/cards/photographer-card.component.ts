import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PhotographerSummary } from '../../core/models';
import { FavoritesStore } from '../../core/state/stores';
import { priceLabel } from '../../core/util/price';
import { formatDate } from '../../core/util/dates';
import { CATEGORIES_BY_ID } from '../../core/util/categories';
import { IconComponent } from '../ui/icon.component';
import { RatingComponent } from '../ui/misc';

@Component({
  selector: 'app-photographer-card',
  imports: [RouterLink, IconComponent, RatingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <article class="c card card--hover" [class.active]="active()" [class.row]="layout() === 'row'">
    <a class="media" [routerLink]="['/photographers', p().id]" [attr.aria-label]="'View profile of ' + p().displayName" tabindex="-1">
      <img [src]="p().coverUrl" alt="" loading="lazy" width="400" height="260" />
      @if (p().featured) { <span class="tag">Featured</span> }
    </a>
    <button type="button" class="fav" [class.on]="fav.has(p().id)" (click)="fav.toggle(p().id)" [attr.aria-pressed]="fav.has(p().id)" [attr.aria-label]="(fav.has(p().id) ? 'Remove ' : 'Save ') + p().displayName + (fav.has(p().id) ? ' from' : ' to') + ' favourites'"><app-icon name="heart" [size]="18" /></button>
    <div class="body">
      <div class="who"><img class="av" [src]="p().avatarUrl" alt="" width="44" height="44" loading="lazy" />
        <div class="grow"><h3><a [routerLink]="['/photographers', p().id]">{{ p().displayName }}</a>@if (p().identityVerified) { <app-icon name="badge-check" [size]="16" class="vf" /><span class="sr-only">Identity verified</span> }</h3>
          <div class="loc"><app-icon name="map-pin" [size]="13" />{{ p().city }}@if (p().workMode === 'shop') { · Studio }@if (p().distanceKm != null) { · {{ p().distanceKm }} km away }</div></div></div>
      <div class="meta"><app-rating [value]="p().rating" [count]="p().reviewCount" /><span class="sub">{{ p().yearsExperience }} yrs experience</span></div>
      <div class="chips">@for (s of specs(); track s) { <span>{{ s }}</span> }</div>
      <div class="foot"><div class="pr"><span class="xs muted">Starting price</span><strong>{{ price() }}</strong></div>
        <div class="av2" [class.ok]="p().availableOnDate">@if (p().availableOnDate !== undefined) { {{ p().availableOnDate ? 'Available' : 'Unavailable' }} on date } @else if (p().nextAvailable) { Next: {{ next() }} }</div></div>
      @if (compare()) { <button type="button" class="btn btn--sm btn--outline cmp" [class.is-on]="compared()" (click)="compareToggle.emit(p())"><app-icon [name]="compared() ? 'check' : 'git-compare'" [size]="14" />{{ compared() ? 'Added to compare' : 'Compare' }}</button> }
    </div>
  </article>`,
  styles: `.c { position: relative; overflow: hidden; display: flex; flex-direction: column; height: 100%; } .c.active { border-color: var(--c-primary-600); box-shadow: 0 0 0 2px var(--c-primary-600); }
  .media { position: relative; display: block; aspect-ratio: 16 / 10; background: var(--c-surface-3); overflow: hidden; } .media img { width: 100%; height: 100%; object-fit: cover; transition: transform .5s var(--ease); } .c:hover .media img { transform: scale(1.04); }
  .tag { position: absolute; left: 10px; top: 10px; background: var(--c-ink-bg); color: #fff; font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 99px; }
  .fav { position: absolute; right: 10px; top: 10px; width: 36px; height: 36px; border-radius: 50%; border: 0; background: rgb(255 255 255 / 92%); cursor: pointer; display: grid; place-items: center; color: #0f172a; box-shadow: var(--shadow-1); } .fav:hover { transform: scale(1.08); } .fav.on { color: var(--c-primary-600); } .fav.on app-icon { fill: currentColor; display: inline-flex; }
  .body { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 10px; flex: 1; } .who { display: flex; gap: 10px; align-items: center; } .av { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; margin-top: -30px; border: 3px solid var(--c-surface); background: var(--c-surface-3); }
  h3 { font-family: var(--font-body); font-size: 1rem; font-weight: 700; display: flex; align-items: center; gap: 5px; } h3 a { color: var(--c-ink); text-decoration: none; } h3 a::after { content: ''; position: absolute; inset: 0; z-index: 1; } .vf { color: var(--c-info); } .fav, .cmp { position: relative; z-index: 2; } .fav { position: absolute; }
  .loc { font-size: 13px; color: var(--c-text-muted); display: flex; align-items: center; gap: 4px; } .meta { display: flex; justify-content: space-between; align-items: center; } .sub { font-size: 12px; color: var(--c-text-muted); }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; } .chips span { font-size: 12px; padding: 3px 10px; background: var(--c-surface-2); border-radius: 99px; color: var(--c-text-muted); }
  .foot { display: flex; justify-content: space-between; align-items: flex-end; margin-top: auto; padding-top: 10px; border-top: 1px solid var(--c-border); } .pr { display: flex; flex-direction: column; } .pr strong { font-size: 1.05rem; font-variant-numeric: tabular-nums; } .av2 { font-size: 12px; color: var(--c-text-muted); text-align: right; } .av2.ok { color: var(--c-success); font-weight: 600; }
  .cmp.is-on { background: var(--c-ink-bg); color: #fff; }
  .row { flex-direction: row; } .row .media { width: 38%; aspect-ratio: auto; flex: none; min-height: 210px; } .row .media img { position: absolute; inset: 0; } .row .av { margin-top: 0; } @media (max-width: 640px) { .row { flex-direction: column; } .row .media { width: 100%; aspect-ratio: 16/10; min-height: 0; } }`,
})
export class PhotographerCardComponent {
  readonly p = input.required<PhotographerSummary>(); readonly active = input(false); readonly compare = input(false); readonly compared = input(false); readonly layout = input<'card' | 'row'>('card');
  readonly compareToggle = output<PhotographerSummary>();
  readonly fav = inject(FavoritesStore);
  readonly price = computed(() => priceLabel(this.p().startingPrice));
  readonly specs = computed(() => this.p().specialties.slice(0, 3).map(s => CATEGORIES_BY_ID[s] ?? s));
  readonly next = computed(() => { const n = this.p().nextAvailable; return n ? formatDate(n, { day: 'numeric', month: 'short' }) : ''; });
}
