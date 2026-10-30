import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { PricingModel, ServicePackage } from '../../core/models';
import { formatMoney } from '../../core/util/price';
import { IconComponent } from '../ui/icon.component';
import { TierBadgeComponent } from '../ui/badges';

/** Tier-styled package card. The tier is purely visual — price and inclusions always come from the photographer. */
@Component({
  selector: 'app-package-card',
  imports: [IconComponent, TierBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <article class="p" [class]="'tier-' + pkg().tier" [class.sel]="selected()" [class.dim]="status() === 'draft'">
    <header><app-tier-badge [tier]="pkg().tier" />@if (pkg().featured) { <span class="rec"><app-icon name="sparkles" [size]="13" />Recommended</span> }</header>
    <h3>{{ pkg().name }}</h3>
    <div class="price"><strong>{{ amount() }}</strong>@if (suffix()) { <span>{{ suffix() }}</span> }</div>
    <p class="desc">{{ pkg().description }}</p>
    <ul class="facts">
      <li><app-icon name="clock" [size]="15" />{{ hours() }}</li><li><app-icon name="image" [size]="15" />{{ pkg().editedPhotos }} edited photos</li>
      <li><app-icon name="map-pin" [size]="15" />{{ pkg().locations }} location{{ pkg().locations > 1 ? 's' : '' }}</li>
      @if (pkg().outfitChanges) { <li><app-icon name="shirt" [size]="15" />{{ pkg().outfitChanges }} outfit change{{ pkg().outfitChanges > 1 ? 's' : '' }}</li> }
      <li><app-icon name="send" [size]="15" />Delivered in {{ pkg().deliveryDays }} days</li>
    </ul>
    <ul class="inc">@for (i of pkg().includes; track i) { <li><app-icon name="check" [size]="15" />{{ i }}</li> }</ul>
    @if (selectable()) { <button type="button" class="btn btn--block pick" [attr.aria-pressed]="selected()" (click)="chosen.emit(pkg())">{{ selected() ? 'Selected' : 'Choose ' + pkg().name }}</button> }
    <ng-content />
  </article>`,
  styles: `.p { --fg: var(--tier-bronze-fg); --bg: var(--tier-bronze-bg); --bd: var(--tier-bronze-border); --gr: var(--tier-bronze-grad); position: relative; display: flex; flex-direction: column; gap: 12px; padding: 20px; border-radius: 16px; background: var(--c-surface); border: 1px solid var(--bd); box-shadow: var(--shadow-1); overflow: hidden; height: 100%; transition: box-shadow .2s, transform .2s; }
  .p::before { content: ''; position: absolute; inset: 0 0 auto 0; height: 6px; background: var(--gr); } .p:hover { box-shadow: var(--shadow-2); }
  .tier-silver { --fg: var(--tier-silver-fg); --bg: var(--tier-silver-bg); --bd: var(--tier-silver-border); --gr: var(--tier-silver-grad); } .tier-gold { --fg: var(--tier-gold-fg); --bg: var(--tier-gold-bg); --bd: var(--tier-gold-border); --gr: var(--tier-gold-grad); } .tier-platinum { --fg: var(--tier-platinum-fg); --bg: var(--tier-platinum-bg); --bd: var(--tier-platinum-border); --gr: var(--tier-platinum-grad); }
  .sel { box-shadow: 0 0 0 2px var(--fg), var(--shadow-2); background: linear-gradient(180deg, var(--bg), var(--c-surface) 40%); } .dim { opacity: .75; border-style: dashed; }
  header { display: flex; justify-content: space-between; align-items: center; margin-top: 6px; } .rec { display: inline-flex; gap: 4px; align-items: center; font-size: 12px; font-weight: 600; color: var(--c-primary-text); }
  h3 { font-size: 1.3rem; } .price strong { font-family: var(--font-display); font-size: 1.7rem; color: var(--c-ink); font-variant-numeric: tabular-nums; } .price span { color: var(--c-text-muted); font-size: 14px; margin-left: 4px; } .desc { font-size: 14px; color: var(--c-text-muted); }
  ul { display: flex; flex-direction: column; gap: 8px; font-size: 14px; } li { display: flex; gap: 10px; align-items: center; } .facts { padding: 12px 0; border-block: 1px solid var(--c-border); color: var(--c-text); } .facts app-icon { color: var(--fg); } .inc app-icon { color: var(--c-success); }
  .pick { margin-top: auto; background: var(--bg); color: var(--fg); border: 1px solid var(--bd); } .pick:hover { background: var(--bd); } .sel .pick { background: var(--fg); color: #fff; border-color: var(--fg); }`,
})
export class PackageCardComponent {
  readonly pkg = input.required<ServicePackage>(); readonly model = input<PricingModel>('fixed'); readonly selected = input(false); readonly selectable = input(false); readonly status = input<string>('published');
  readonly chosen = output<ServicePackage>();
  readonly amount = computed(() => this.model() === 'quote' || this.pkg().price == null ? 'Custom quote' : formatMoney(this.pkg().price, this.pkg().currency));
  readonly suffix = computed(() => (this.model() === 'hourly' && this.pkg().price != null ? '/ hour' : this.model() === 'starting' && this.pkg().price != null ? 'starting price' : ''));
  readonly hours = computed(() => { const m = this.pkg().durationMinutes; return m % 60 === 0 ? `${m / 60} hour${m > 60 ? 's' : ''}` : `${Math.floor(m / 60)}h ${m % 60}m`; });
}
