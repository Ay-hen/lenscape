import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';
import { AnalyticsRepository, BookingRepository, CatalogRepository, PhotographerWorkspaceRepository } from '../../core/api/repositories';
import { Booking, DateRange } from '../../core/models';
import { addDays, formatDate, timeAgo, todayISO } from '../../core/util/dates';
import { errorText } from '../../core/util/forms';
import { formatMoney } from '../../core/util/price';
import { LineChartComponent, BarChartComponent } from '../../shared/charts/charts';
import { BookingDetailComponent } from '../../shared/bookings/booking-detail.component';
import { BadgeComponent } from '../../shared/ui/badges';
import { IconComponent } from '../../shared/ui/icon.component';
import { ModalComponent } from '../../shared/ui/modal.component';
import { EmptyStateComponent, ErrorStateComponent, PageHeaderComponent, RatingComponent, StatCardComponent } from '../../shared/ui/misc';
import { ConfirmService, ToastService } from '../../shared/services/overlay.services';
import { SeoService } from '../../core/seo.service';

const RANGES = [{ id: '30', label: '30 days', days: 30 }, { id: '90', label: '90 days', days: 90 }, { id: '365', label: '12 months', days: 365 }];

@Component({
  selector: 'app-studio-dashboard',
  imports: [RouterLink, LineChartComponent, BarChartComponent, BookingDetailComponent, BadgeComponent, IconComponent, ModalComponent, EmptyStateComponent, ErrorStateComponent, PageHeaderComponent, RatingComponent, StatCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <app-page-header [title]="'Welcome back, ' + first() + ''" subtitle="Your studio at a glance — bookings, revenue and profile health.">
    <div class="seg" role="group" aria-label="Date range">@for (r of ranges; track r.id) { <button type="button" [attr.aria-pressed]="range() === r.id" (click)="range.set(r.id)">{{ r.label }}</button> }</div>
    <a class="btn btn--primary" routerLink="/studio/services/new"><app-icon name="plus" [size]="16" />New service</a>
  </app-page-header>

  @if (res.error()) { <app-error-state [error]="res.error()" (retry)="res.reload()" /> }
  @else if (res.isLoading() && !res.value()) { <div class="grid grid--4">@for (s of [1,2,3,4,5,6,7,8]; track s) { <div class="skeleton" style="height: 108px"></div> }</div> }
  @else if (res.value(); as d) {
    <div class="grid grid--4 stats">
      <app-stat-card label="Today's sessions" [value]="today().length" icon="calendar" [hint]="today().length ? 'Next at ' + today()[0].startTime : 'Nothing scheduled'" />
      <app-stat-card label="Upcoming (7 days)" [value]="next7().length" icon="calendar-check" hint="Confirmed sessions" />
      <app-stat-card label="New requests" [value]="pending().length" icon="bell-ring" [hint]="pending().length ? 'Awaiting your answer' : 'All answered'" [trend]="pending().length ? 'down' : null" />
      <app-stat-card label="Pending confirmations" [value]="awaitingPayment()" icon="hourglass" hint="Confirmed but unpaid" />
      <app-stat-card label="Booking value" [value]="money(rangeValue())" icon="banknote" [hint]="'Confirmed + completed, last ' + rangeLabel()" />
      <app-stat-card label="Est. earnings" [value]="money(rangeEarnings())" icon="wallet" hint="After platform fee (estimate)" />
      <app-stat-card label="Request → confirmed" [value]="(d.analytics.conversionRate * 100).toFixed(0) + '%'" icon="trending-up" hint="Share of requests you accepted" />
      <app-stat-card label="Profile views" [value]="d.profile.profileViews.toLocaleString('en-US')" icon="eye" [hint]="'Favourited by ' + d.profile.favoritesCount" />
    </div>

    <div class="two">
      <section class="card"><div class="card__head"><h3>Revenue trend</h3><span class="xs muted">Booking value, MAD</span></div><div class="card__body"><app-line-chart [series]="[d.analytics.revenue]" label="Revenue per month" suffix=" MAD" /></div></section>
      <section class="card"><div class="card__head"><h3>Bookings per month</h3><span class="xs muted">All requests</span></div><div class="card__body"><app-bar-chart [data]="d.analytics.bookings.points" label="Bookings per month" /></div></section>
    </div>

    <div class="three">
      <section class="card"><div class="card__head"><h3>New requests</h3><a routerLink="/studio/bookings" [queryParams]="{ tab: 'pending' }" class="small">View all</a></div>
        @if (pending().length) { <ul class="lst">@for (b of pending().slice(0, 4); track b.id) { <li><button type="button" class="it" (click)="open.set(b)"><strong>{{ b.customerName }}</strong><span class="muted small">{{ b.serviceTitle }} · {{ fmt(b.date) }} {{ b.startTime }}</span></button>
          <div class="qa"><button class="btn btn--sm btn--primary" type="button" (click)="quick(b, 'confirmed')">Confirm</button><button class="btn btn--sm btn--ghost" type="button" (click)="quick(b, 'rejected')">Decline</button></div></li> }</ul> }
        @else { <app-empty-state icon="check-circle" title="No requests waiting" text="New booking requests will appear here." /> }</section>
      <section class="card"><div class="card__head"><h3>Today & next up</h3><a routerLink="/studio/calendar" class="small">Calendar</a></div>
        @if (agenda().length) { <ul class="lst">@for (b of agenda(); track b.id) { <li><button type="button" class="it" (click)="open.set(b)"><strong>{{ b.startTime }} · {{ b.serviceTitle }}</strong><span class="muted small">{{ b.customerName }} · {{ fmt(b.date) }} · {{ b.location.city }}</span></button><app-badge [status]="b.status" /></li> }</ul> }
        @else { <app-empty-state icon="calendar" title="No upcoming sessions" text="Confirmed bookings show up here." /> }</section>
      <section class="card"><div class="card__head"><h3>Profile health</h3><span class="xs muted">{{ completion().pct }}% complete</span></div>
        <div class="card__body stack"><div class="bar" role="progressbar" [attr.aria-valuenow]="completion().pct" aria-valuemin="0" aria-valuemax="100" aria-label="Profile completion"><div [style.width.%]="completion().pct"></div></div>
          <ul class="chk">@for (c of completion().items; track c.label) { <li [class.ok]="c.ok"><app-icon [name]="c.ok ? 'check-circle' : 'x-circle'" [size]="16" /><a [routerLink]="c.link">{{ c.label }}</a></li> }</ul>
          <div class="rt"><app-rating [value]="d.profile.rating" [count]="d.profile.reviewCount" /></div></div></section>
    </div>

    <section class="card qk"><div class="card__head"><h3>Quick actions</h3></div><div class="card__body row">
      <a class="btn btn--outline" routerLink="/studio/availability"><app-icon name="clock" [size]="16" />Edit availability</a><a class="btn btn--outline" routerLink="/studio/packages"><app-icon name="layers" [size]="16" />Packages</a><a class="btn btn--outline" routerLink="/studio/portfolio"><app-icon name="image" [size]="16" />Upload photos</a><a class="btn btn--outline" routerLink="/studio/automation"><app-icon name="zap" [size]="16" />Automation</a><a class="btn btn--outline" [routerLink]="['/photographers', d.profile.id]"><app-icon name="external-link" [size]="16" />View public profile</a></div></section>
  }
  <app-modal [open]="!!open()" label="Booking details" [wide]="true" (closed)="open.set(null)">@if (open(); as b) { <app-booking-detail [booking]="b" role="photographer" (changed)="open.set($event); res.reload()" /> }</app-modal>`,
  styles: `.seg { display: inline-flex; border: 1px solid var(--c-border-strong); border-radius: 10px; overflow: hidden; background: var(--c-surface); } .seg button { padding: 0 14px; height: 40px; border: 0; background: transparent; cursor: pointer; font-weight: 600; font-size: 13px; } .seg [aria-pressed='true'] { background: var(--c-ink-bg); color: #fff; }
  .notice { align-items: center; margin-bottom: 18px; } .stats { margin-bottom: 20px; } .two { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 16px; margin-bottom: 16px; } .three { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-bottom: 16px; } @media (max-width: 1100px) { .three { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } } @media (max-width: 800px) { .two, .three { grid-template-columns: minmax(0, 1fr); } }
  h3 { font-size: 1.1rem; } .lst li { display: flex; gap: 10px; align-items: center; padding: 12px 20px; border-top: 1px solid var(--c-border); } .it { flex: 1; min-width: 0; text-align: left; background: none; border: 0; cursor: pointer; display: flex; flex-direction: column; padding: 0; } .qa { display: flex; gap: 4px; }
  .bar { height: 8px; background: var(--c-surface-2); border-radius: 99px; overflow: hidden; } .bar div { height: 100%; background: var(--c-success); border-radius: 99px; transition: width .5s var(--ease); } .chk { display: flex; flex-direction: column; gap: 8px; font-size: 14px; } .chk li { display: flex; gap: 8px; align-items: center; color: var(--c-text-muted); } .chk li.ok { color: var(--c-success); } .chk li.ok a { color: var(--c-text-muted); text-decoration: line-through; } .chk a { color: var(--c-ink); } .rt { padding-top: 8px; border-top: 1px solid var(--c-border); }`,
})
export class StudioDashboardPage {
  private ws = inject(PhotographerWorkspaceRepository); private bookings = inject(BookingRepository); private analytics = inject(AnalyticsRepository); private catalog = inject(CatalogRepository);
  private toast = inject(ToastService); private confirm = inject(ConfirmService);
  readonly ranges = RANGES; readonly range = signal('90'); readonly open = signal<Booking | null>(null);
  readonly rangeLabel = computed(() => RANGES.find(r => r.id === this.range())!.label);
  readonly dateRange = computed<DateRange>(() => ({ from: addDays(todayISO(), -RANGES.find(r => r.id === this.range())!.days), to: addDays(todayISO(), 30) }));
  readonly res = rxResource({
    params: () => this.dateRange(),
    stream: ({ params }) => this.ws.myProfile().pipe(switchMap(profile => forkJoin({
      profile: of(profile),
      analytics: this.analytics.photographer(profile.id, params),
      bookings: this.bookings.list({ page: 1, pageSize: 500 }),
      services: this.catalog.services(profile.id, { includeUnpublished: true }),
      packages: this.catalog.packages(profile.id, { includeUnpublished: true }),
    }))),
  });
  readonly first = computed(() => this.res.value()?.profile.displayName.split(' ')[0] ?? '');
  private all = computed<Booking[]>(() => this.res.value()?.bookings.items ?? []);
  readonly today = computed(() => this.all().filter(b => b.date === todayISO() && b.status === 'confirmed').sort((a, b) => a.startTime.localeCompare(b.startTime)));
  readonly next7 = computed(() => this.all().filter(b => b.status === 'confirmed' && b.date >= todayISO() && b.date <= addDays(todayISO(), 7)));
  readonly pending = computed(() => this.all().filter(b => b.status === 'pending').sort((a, b) => a.date.localeCompare(b.date)));
  readonly agenda = computed(() => this.all().filter(b => b.status === 'confirmed' && b.date >= todayISO()).sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)).slice(0, 5));
  readonly awaitingPayment = computed(() => this.all().filter(b => b.status === 'confirmed' && b.paymentStatus === 'unpaid').length);
  private inRange = computed(() => this.all().filter(b => (b.status === 'confirmed' || b.status === 'completed') && b.date >= this.dateRange().from && b.date <= todayISO()));
  readonly rangeValue = computed(() => this.inRange().reduce((s, b) => s + b.pricing.total, 0));
  readonly rangeEarnings = computed(() => this.inRange().reduce((s, b) => s + b.pricing.total - b.pricing.platformFee, 0));
  readonly completion = computed(() => {
    const v = this.res.value(); if (!v) return { pct: 0, items: [] as { label: string; ok: boolean; link: string }[] };
    const p = v.profile; const items = [
      { label: 'Write a bio (100+ characters)', ok: p.bio.length >= 100, link: '/studio/profile' }, { label: 'Set your map location', ok: p.onboardingStep >= 3, link: '/studio/profile' },
      { label: 'Choose your specialties', ok: p.specialties.length > 0, link: '/studio/profile' }, { label: 'Add 6+ portfolio photos', ok: p.portfolio.length >= 6, link: '/studio/portfolio' },
      { label: 'Add a service', ok: v.services.some(s => s.status === 'published'), link: '/studio/services' }, { label: 'Add a package', ok: v.packages.some(k => k.status === 'published'), link: '/studio/packages' }];
    return { pct: Math.round((items.filter(i => i.ok).length / items.length) * 100), items };
  });
  readonly money = (n: number) => formatMoney(n, 'MAD'); readonly fmt = (d: string) => formatDate(d, { weekday: 'short', day: 'numeric', month: 'short' }); readonly ago = timeAgo;
  async quick(b: Booking, status: 'confirmed' | 'rejected') {
    let note: string | undefined;
    if (status === 'rejected') { const r = await this.confirm.ask({ title: 'Decline this request?', message: 'The customer will be notified.', confirmText: 'Decline', danger: true, reasonLabel: 'Reason (shared with the customer)', reasonRequired: true }); if (!r.ok) return; note = r.reason; }
    this.bookings.setStatus(b.id, status, note).subscribe({ next: () => { this.toast.success(status === 'confirmed' ? 'Booking confirmed.' : 'Request declined.'); this.res.reload(); }, error: e => this.toast.error(errorText(e)) });
  }
  constructor() { inject(SeoService).set('Studio dashboard'); }
}
