import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AnalyticsRepository } from '../../core/api/repositories';
import { addDays, todayISO } from '../../core/util/dates';
import { formatMoney } from '../../core/util/price';
import { SeoService } from '../../core/seo.service';
import { BarChartComponent, DonutChartComponent, HBarListComponent, LineChartComponent } from '../../shared/charts/charts';
import { ErrorStateComponent, PageHeaderComponent } from '../../shared/ui/misc';

const RANGES = [{ id: '90', label: '90 days', days: 90 }, { id: '180', label: '6 months', days: 180 }, { id: '365', label: '12 months', days: 365 }];

@Component({
  selector: 'app-admin-analytics',
  imports: [BarChartComponent, DonutChartComponent, HBarListComponent, LineChartComponent, ErrorStateComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <app-page-header title="Reports & analytics" subtitle="Marketplace performance over time. Figures come from booking records.">
    <div class="seg" role="group" aria-label="Date range">@for (r of ranges; track r.id) { <button type="button" [attr.aria-pressed]="range() === r.id" (click)="range.set(r.id)">{{ r.label }}</button> }</div></app-page-header>
  @if (res.error()) { <app-error-state [error]="res.error()" (retry)="res.reload()" /> }
  @else if (!res.value()) { <div class="skeleton" style="height: 360px"></div> }
  @else { @let a = res.value()!;
    <div class="two">
      <section class="card"><div class="card__head"><h3>Bookings</h3></div><div class="card__body"><app-line-chart [series]="[a.bookingsOverTime, a.cancellationsOverTime]" label="Bookings and cancellations per month" /></div></section>
      <section class="card"><div class="card__head"><h3>Booking value (MAD)</h3></div><div class="card__body"><app-bar-chart [data]="a.revenueOverTime.points" label="Booking value per month" suffix=" MAD" /></div></section>
      <section class="card"><div class="card__head"><h3>Customer acquisition</h3></div><div class="card__body"><app-line-chart [series]="[a.customerAcquisition]" label="New customers per month" /></div></section>
      <section class="card"><div class="card__head"><h3>Request outcomes</h3></div><div class="card__body"><app-donut-chart [data]="a.conversion" label="Booking outcomes" centerLabel="requests" /></div></section>
      <section class="card"><div class="card__head"><h3>Popular services</h3></div><div class="card__body"><app-hbar-list [data]="a.popularServices" label="Bookings by service" /></div></section>
      <section class="card"><div class="card__head"><h3>Top photographers</h3></div><div class="tw"><table class="table"><caption class="sr-only">Top photographers by revenue</caption><thead><tr><th>Photographer</th><th class="r">Bookings</th><th class="r">Value</th><th class="r">Rating</th></tr></thead><tbody>@for (p of a.topPhotographers; track p.name) { <tr><td>{{ p.name }}</td><td class="r tnum">{{ p.bookings }}</td><td class="r tnum">{{ money(p.revenue) }}</td><td class="r tnum">{{ p.rating.toFixed(1) }}</td></tr> }</tbody></table></div></section>
    </div>
    <p class="muted small">Computed from real bookings and customer sign-ups. Revenue counts confirmed and completed bookings by session date.</p>
  }`,
  styles: `.seg { display: inline-flex; border: 1px solid var(--c-border-strong); border-radius: 10px; overflow: hidden; background: var(--c-surface); } .seg button { padding: 0 14px; height: 40px; border: 0; background: transparent; cursor: pointer; font-weight: 600; font-size: 13px; } .seg [aria-pressed='true'] { background: var(--c-ink-bg); color: #fff; } .two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; margin-bottom: 16px; } @media (max-width: 860px) { .two { grid-template-columns: minmax(0, 1fr); } } h3 { font-size: 1.1rem; } .tw { overflow-x: auto; } .r { text-align: right; }`,
})
export class AdminAnalyticsPage {
  readonly ranges = RANGES; readonly range = signal('180'); private repo = inject(AnalyticsRepository);
  readonly res = rxResource({ params: () => this.range(), stream: ({ params }) => this.repo.platform({ from: addDays(todayISO(), -RANGES.find(r => r.id === params)!.days), to: todayISO() }) });
  readonly money = (n: number) => formatMoney(Math.round(n), 'MAD');
  constructor() { inject(SeoService).set('Analytics'); }
}
