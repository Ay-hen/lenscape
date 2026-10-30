import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AdminRepository } from '../../core/api/repositories';
import { formatMoney } from '../../core/util/price';
import { timeAgo } from '../../core/util/dates';
import { SeoService } from '../../core/seo.service';
import { BarChartComponent, HBarListComponent, LineChartComponent } from '../../shared/charts/charts';
import { ErrorStateComponent, PageHeaderComponent, StatCardComponent } from '../../shared/ui/misc';

@Component({
  selector: 'app-admin-overview',
  imports: [RouterLink, BarChartComponent, HBarListComponent, LineChartComponent, ErrorStateComponent, PageHeaderComponent, StatCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <app-page-header title="Platform overview" subtitle="Health of the marketplace at a glance." />
  @if (res.error()) { <app-error-state [error]="res.error()" (retry)="res.reload()" /> }
  @else if (!res.value()) { <div class="grid grid--4">@for (s of [1,2,3,4,5,6,7,8]; track s) { <div class="skeleton" style="height: 108px"></div> }</div> }
  @else { @let o = res.value()!;
    @if (o.pendingApprovals || o.openDisputes || o.openReports) {
      <div class="todo"><strong>Needs attention</strong>
        @if (o.pendingApprovals) { <a routerLink="/admin/approvals" class="chip">{{ o.pendingApprovals }} application(s) to review</a> }
        @if (o.openDisputes) { <a routerLink="/admin/bookings" [queryParams]="{ tab: 'disputes' }" class="chip">{{ o.openDisputes }} open dispute(s)</a> }
        @if (o.openReports) { <a routerLink="/admin/moderation" [queryParams]="{ tab: 'reports' }" class="chip">{{ o.openReports }} open report(s)</a> }</div> }
    <div class="grid grid--4 st">
      <app-stat-card label="Customers" [value]="o.totalCustomers" icon="users" />
      <app-stat-card label="Photographers" [value]="o.totalPhotographers" icon="camera" [hint]="o.pendingApprovals + ' awaiting approval'" />
      <app-stat-card label="Active services" [value]="o.activeServices" icon="layers" [hint]="o.publishedPackages + ' published packages'" />
      <app-stat-card label="Bookings" [value]="o.totalBookings" icon="calendar-check" [hint]="o.upcomingBookings + ' upcoming'" />
      <app-stat-card label="Gross booking value" [value]="money(o.grossBookingValue)" icon="banknote" hint="Confirmed + completed" />
      <app-stat-card label="Platform fees (est.)" [value]="money(o.platformRevenue)" icon="wallet" hint="Commission on those bookings" />
      <app-stat-card label="Cancellation rate" [value]="(o.cancellationRate * 100).toFixed(1) + '%'" icon="x-circle" />
      <app-stat-card label="Open disputes" [value]="o.openDisputes" icon="alert-triangle" [trend]="o.openDisputes ? 'down' : null" [hint]="o.openReports + ' open reports'" />
    </div>
    <div class="two">
      <section class="card"><div class="card__head"><h3>Bookings per month</h3></div><div class="card__body"><app-bar-chart [data]="o.bookingTrend.points" label="Bookings per month" /></div></section>
      <section class="card"><div class="card__head"><h3>Sign-ups</h3></div><div class="card__body"><app-line-chart [series]="[o.customerGrowth, o.photographerGrowth]" label="New customers and photographers per month" /></div></section>
    </div>
    <div class="two">
      <section class="card"><div class="card__head"><h3>Top categories</h3></div><div class="card__body"><app-hbar-list [data]="o.topCategories" label="Bookings by category" /></div></section>
      <section class="card"><div class="card__head"><h3>Recent activity</h3><a routerLink="/admin/audit" class="small">Audit log</a></div>
        <ul class="act">@for (a of o.recentActivity.slice(0, 7); track a.id) { <li><strong>{{ a.actor }}</strong> {{ a.action }} <em>{{ a.target }}</em><span class="muted xs">{{ ago(a.at) }}</span></li> } @empty { <li class="muted">Nothing yet.</li> }</ul></section>
    </div>
  }`,
  styles: `.todo { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 14px 18px; border-radius: 14px; background: var(--c-primary-50); border: 1px solid var(--c-primary-200); margin-bottom: 18px; } .todo a { text-decoration: none; } .st { margin-bottom: 20px; } .two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; margin-bottom: 16px; } @media (max-width: 860px) { .two { grid-template-columns: minmax(0, 1fr); } } h3 { font-size: 1.1rem; } .act li { display: flex; flex-wrap: wrap; gap: 6px; padding: 11px 20px; border-top: 1px solid var(--c-border); font-size: 14px; } .act .xs { margin-left: auto; }`,
})
export class AdminOverviewPage {
  private repo = inject(AdminRepository);
  readonly res = rxResource({ stream: () => this.repo.overview() });
  readonly money = (n: number) => formatMoney(Math.round(n), 'MAD'); readonly ago = timeAgo;
  constructor() { inject(SeoService).set('Admin overview'); }
}
