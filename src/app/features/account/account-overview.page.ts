import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { BookingRepository, CatalogRepository } from '../../core/api/repositories';
import { AuthService } from '../../core/auth/auth.service';
import { FavoritesStore, NotificationsStore, RecentlyViewedStore } from '../../core/state/stores';
import { formatDate, todayISO, timeAgo } from '../../core/util/dates';
import { formatMoney } from '../../core/util/price';
import { PhotographerCardComponent } from '../../shared/cards/photographer-card.component';
import { BadgeComponent } from '../../shared/ui/badges';
import { IconComponent } from '../../shared/ui/icon.component';
import { EmptyStateComponent, ErrorStateComponent, PageHeaderComponent, StatCardComponent } from '../../shared/ui/misc';
import { SeoService } from '../../core/seo.service';

@Component({
  selector: 'app-account-overview',
  imports: [RouterLink, PhotographerCardComponent, BadgeComponent, IconComponent, EmptyStateComponent, ErrorStateComponent, PageHeaderComponent, StatCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <app-page-header [title]="'Hello, ' + firstName() + ' 👋'" subtitle="Here's what's happening with your bookings."><a class="btn btn--primary" routerLink="/discover"><app-icon name="search" [size]="16" />Find a photographer</a></app-page-header>
  @if (data.error()) { <app-error-state [error]="data.error()" (retry)="data.reload()" /> }
  @else if (data.isLoading() && !data.value()) { <div class="grid grid--4">@for (s of [1,2,3,4]; track s) { <div class="skeleton" style="height: 110px"></div> }</div> }
  @else if (data.value(); as d) {
    <div class="grid grid--4"><app-stat-card label="Upcoming sessions" [value]="upcoming().length" icon="calendar-check" hint="Confirmed & in the future" /><app-stat-card label="Awaiting confirmation" [value]="pending().length" icon="hourglass" hint="Photographer hasn't replied yet" />
      <app-stat-card label="Completed" [value]="completed().length" icon="check-circle" /><app-stat-card label="Saved photographers" [value]="fav.count()" icon="heart" /></div>

    @if (toReview().length) { <div class="notice notice--info rv"><app-icon name="star" [size]="18" /><span>How was <strong>{{ toReview()[0].photographerName }}</strong>? Leave a review for your {{ toReview()[0].serviceTitle }} session.</span><a class="btn btn--sm btn--primary" routerLink="/account/bookings" [queryParams]="{ tab: 'history' }">Review now</a></div> }

    <div class="two">
      <section class="card"><div class="card__head"><h3>Next session</h3><a routerLink="/account/bookings" class="small">All bookings</a></div>
        @if (upcoming()[0]; as b) { <div class="next"><div class="date"><strong>{{ day(b.date) }}</strong><span>{{ mon(b.date) }}</span></div><div class="grow"><strong>{{ b.serviceTitle }}</strong><div class="muted small">with {{ b.photographerName }}</div><div class="small">{{ b.startTime }}–{{ b.endTime }} · {{ b.location.city }}</div></div><app-badge [status]="b.status" /></div> }
        @else { <app-empty-state icon="calendar" title="No upcoming sessions" text="Find a photographer and request your first session." actionLabel="Browse photographers" actionLink="/discover" /> }</section>
      <section class="card"><div class="card__head"><h3>Pending requests</h3></div>
        @if (pending().length) { <ul>@for (b of pending().slice(0, 4); track b.id) { <li><div class="grow"><strong>{{ b.photographerName }}</strong><div class="small muted">{{ b.serviceTitle }} · {{ fmt(b.date) }}</div></div><app-badge status="pending" /></li> }</ul> } @else { <p class="pad muted small">No requests waiting on a photographer.</p> }</section>
    </div>

    <section class="blk"><div class="blk__h"><h3>Favourite photographers</h3><a routerLink="/account/favorites" class="small">See all</a></div>
      @if (d.favs.length) { <div class="grid grid--4">@for (p of d.favs.slice(0, 4); track p.id) { <app-photographer-card [p]="p" /> }</div> } @else { <div class="card"><app-empty-state icon="heart" title="No favourites yet" text="Tap the heart on a photographer to save them here." /></div> }</section>
    @if (d.recent.length) { <section class="blk"><h3>Recently viewed</h3><div class="grid grid--4">@for (p of d.recent.slice(0, 4); track p.id) { <app-photographer-card [p]="p" /> }</div></section> }
    @if (notes.items().length) { <section class="card blk"><div class="card__head"><h3>Recent activity</h3><a routerLink="/account/notifications" class="small">All</a></div><ul>@for (n of notes.items().slice(0, 3); track n.id) { <li><div class="grow"><strong>{{ n.title }}</strong><div class="small muted">{{ n.body }}</div></div><span class="xs subtle">{{ ago(n.createdAt) }}</span></li> }</ul></section> }
  }`,
  styles: `.rv { margin-block: 20px; align-items: center; } .rv span { flex: 1; } .two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; margin-top: 20px; } @media (max-width: 800px) { .two { grid-template-columns: minmax(0, 1fr); } } li { display: flex; gap: 12px; align-items: center; padding: 14px 20px; border-top: 1px solid var(--c-border); } .pad { padding: 20px; }
  .next { display: flex; gap: 16px; align-items: center; padding: 20px; } .date { width: 60px; height: 64px; border-radius: 14px; background: var(--c-ink-bg); color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; } .date strong { font-family: var(--font-display); font-size: 1.6rem; line-height: 1; } .date span { font-size: 11px; text-transform: uppercase; }
  .blk { margin-top: 32px; } .blk__h { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; } h3 { font-size: 1.2rem; } .blk > h3 { margin-bottom: 12px; }`,
})
export class AccountOverviewPage {
  private bookings = inject(BookingRepository); private catalog = inject(CatalogRepository); private auth = inject(AuthService);
  readonly fav = inject(FavoritesStore); private recentStore = inject(RecentlyViewedStore); readonly notes = inject(NotificationsStore);
  readonly firstName = computed(() => this.auth.user()?.name.split(' ')[0] ?? '');
  readonly data = rxResource({ params: () => this.fav.ids().join(','), stream: () => forkJoin({ bookings: this.bookings.list({ page: 1, pageSize: 500 }), favs: this.fav.ids().length ? this.catalog.summaries(this.fav.ids()) : of([]), recent: this.recentStore.ids().length ? this.catalog.summaries(this.recentStore.ids()) : of([]) }) });
  private all = computed(() => this.data.value()?.bookings.items ?? []);
  readonly upcoming = computed(() => this.all().filter(b => b.status === 'confirmed' && b.date >= todayISO()).sort((a, b) => a.date.localeCompare(b.date)));
  readonly pending = computed(() => this.all().filter(b => b.status === 'pending'));
  readonly completed = computed(() => this.all().filter(b => b.status === 'completed'));
  readonly toReview = computed(() => this.completed().filter(b => !b.reviewed));
  readonly day = (d: string) => formatDate(d, { day: 'numeric' }); readonly mon = (d: string) => formatDate(d, { month: 'short' }); readonly fmt = (d: string) => formatDate(d, { day: 'numeric', month: 'short' }); readonly ago = timeAgo; readonly money = formatMoney;
  constructor() { inject(SeoService).set('My account'); }
}
