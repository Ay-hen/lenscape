import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BookingRepository } from '../../core/api/repositories';
import { Booking, BookingQuery, Role } from '../../core/models';
import { SessionStore } from '../../core/auth/session.store';
import { formatDate, todayISO } from '../../core/util/dates';
import { formatMoney } from '../../core/util/price';
import { BookingDetailComponent } from '../bookings/booking-detail.component';
import { BadgeComponent, TierBadgeComponent } from '../ui/badges';
import { IconComponent } from '../ui/icon.component';
import { ModalComponent } from '../ui/modal.component';
import { TabsComponent, TabItem } from '../ui/tabs.component';
import { EmptyStateComponent, ErrorStateComponent, PageHeaderComponent, PaginationComponent } from '../ui/misc';
import { SeoService } from '../../core/seo.service';

type Tab = 'upcoming' | 'pending' | 'history' | 'all';

/** Booking list shared by customers and photographers — role decides labels and available actions. */
@Component({
  selector: 'app-bookings-page',
  imports: [FormsModule, RouterLink, BookingDetailComponent, BadgeComponent, TierBadgeComponent, IconComponent, ModalComponent, TabsComponent, EmptyStateComponent, ErrorStateComponent, PageHeaderComponent, PaginationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <app-page-header [title]="isClient() ? 'My bookings' : 'Bookings'" [subtitle]="isClient() ? 'Track requests, reschedule, cancel and review.' : 'Confirm requests, manage sessions and deliveries.'">
    @if (isClient()) { <a class="btn btn--primary" routerLink="/discover"><app-icon name="plus" [size]="16" />New booking</a> }
  </app-page-header>
  <div class="card">
    <div class="tb"><app-tabs [tabs]="tabs()" [active]="tab()" label="Booking filters" (changed)="setTab($event)" />
      <label class="sr-only" for="bq">Search bookings</label><div class="input-group"><app-icon name="search" [size]="16" /><input id="bq" class="input" type="search" placeholder="Reference, name, service…" [ngModel]="q()" (ngModelChange)="q.set($event); page.set(1)" /></div></div>
    @if (res.error()) { <div class="pad"><app-error-state [error]="res.error()" (retry)="res.reload()" /></div> }
    @else if (res.isLoading() && !res.value()) { <div class="pad stack">@for (s of [1,2,3]; track s) { <div class="skeleton" style="height: 74px"></div> }</div> }
    @else if (res.value(); as r) {
      @if (!r.items.length) { <app-empty-state icon="calendar-check" [title]="emptyTitle()" [text]="isClient() ? 'When you book a photographer, your sessions show up here.' : 'New booking requests will appear here.'" [actionLabel]="isClient() ? 'Find a photographer' : ''" actionLink="/discover" /> }
      @else {
        <ul class="list" [style.opacity]="res.isLoading() ? .55 : 1">@for (b of r.items; track b.id) {
          <li><button type="button" class="row-b" (click)="selected.set(b)" [attr.aria-label]="'Open booking ' + b.reference">
            <div class="date"><strong>{{ day(b) }}</strong><span>{{ mon(b) }}</span></div>
            <div class="grow main"><div class="t"><strong>{{ b.serviceTitle }}</strong><app-tier-badge [tier]="b.tier" /></div><div class="s muted">{{ isClient() ? b.photographerName : b.customerName }} · {{ b.startTime }}–{{ b.endTime }} · {{ b.location.city }}</div><div class="s xs subtle">{{ b.reference }}</div></div>
            <div class="end"><strong class="tnum">{{ money(b.pricing.total) }}</strong><div class="row"><app-badge [status]="b.status" />@if (b.rescheduleRequest) { <app-badge tone="warning">Reschedule</app-badge> }@if (b.dispute?.state === 'open') { <app-badge tone="error">Dispute</app-badge> }</div></div>
            <app-icon name="chevron-right" [size]="18" /></button></li> }</ul>
        <div class="pad"><app-pagination [page]="r.page" [pageSize]="r.pageSize" [total]="r.total" (pageChange)="page.set($event)" /></div>
      }
    }
  </div>
  <app-modal [open]="!!selected()" label="Booking details" [wide]="true" (closed)="selected.set(null)">
    @if (selected(); as b) { <app-booking-detail [booking]="b" [role]="role()" (changed)="onChanged($event)" /> }
  </app-modal>`,
  styles: `.tb { display: flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap; padding: 0 16px; border-bottom: 1px solid var(--c-border); } .tb app-tabs { flex: 1 1 360px; min-width: 0; } .tb .input-group { width: 260px; margin: 8px 0; } .pad { padding: 16px; }
  .list li + li { border-top: 1px solid var(--c-border); } .row-b { width: 100%; display: flex; gap: 16px; align-items: center; padding: 16px 20px; background: none; border: 0; text-align: left; cursor: pointer; transition: background .15s; } .row-b:hover { background: var(--c-surface-2); }
  .date { width: 54px; height: 58px; flex: none; border-radius: 12px; background: var(--c-primary-50); color: var(--c-primary-text); display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.1; } .date strong { font-family: var(--font-display); font-size: 1.4rem; } .date span { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
  .main { min-width: 0; } .t { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; } .s { font-size: 13px; } .end { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
  @media (max-width: 640px) { .row-b { flex-wrap: wrap; } .end { align-items: flex-start; width: 100%; flex-direction: row; justify-content: space-between; } .tb .input-group { width: 100%; } }`,
})
export class BookingsPage {
  private repo = inject(BookingRepository); private route = inject(ActivatedRoute); private session = inject(SessionStore);
  readonly role = computed<Role>(() => this.session.role() ?? 'client'); readonly isClient = computed(() => this.role() === 'client');
  readonly tab = signal<Tab>('all'); readonly q = signal(''); readonly page = signal(1); readonly selected = signal<Booking | null>(null);
  readonly money = (n: number) => formatMoney(n, 'MAD'); readonly day = (b: Booking) => formatDate(b.date, { day: 'numeric' }); readonly mon = (b: Booking) => formatDate(b.date, { month: 'short' });
  constructor() { inject(SeoService).set('Bookings'); const t = this.route.snapshot.queryParamMap.get('tab') as Tab | null; if (t) this.tab.set(t); }

  private base = rxResource({ params: () => 1, stream: () => this.repo.list({ page: 1, pageSize: 500 }) });
  readonly tabs = computed<TabItem[]>(() => { const all = this.base.value()?.items ?? []; const t = todayISO(); return [
    { id: 'all', label: 'All', count: all.length }, { id: 'pending', label: this.isClient() ? 'Awaiting confirmation' : 'Requests', count: all.filter(b => b.status === 'pending').length },
    { id: 'upcoming', label: 'Upcoming', count: all.filter(b => b.status === 'confirmed' && b.date >= t).length }, { id: 'history', label: 'History', count: all.filter(b => ['completed', 'cancelled', 'rejected', 'expired'].includes(b.status)).length }]; });
  readonly query = computed<BookingQuery>(() => ({ q: this.q().trim() || undefined, status: this.tab() === 'pending' ? 'pending' : 'all', from: this.tab() === 'upcoming' ? todayISO() : undefined, page: this.page(), pageSize: 8 }));
  /** History = several terminal statuses, so it is filtered after the (server-paged) fetch of the full set; a real API should accept a status list. */
  readonly res = rxResource({ params: () => ({ q: this.query(), tab: this.tab() }), stream: ({ params }) => params.tab === 'history'
    ? this.repo.list({ ...params.q, status: 'all', page: 1, pageSize: 500 }).pipe(map(r => { const items = r.items.filter(b => ['completed', 'cancelled', 'rejected', 'expired'].includes(b.status)); const s = (params.q.page - 1) * params.q.pageSize; return { items: items.slice(s, s + params.q.pageSize), total: items.length, page: params.q.page, pageSize: params.q.pageSize }; }))
    : this.repo.list({ ...params.q, ...(params.tab === 'upcoming' ? { status: 'confirmed' as const } : {}) }) });
  readonly emptyTitle = computed(() => (this.tab() === 'all' ? 'No bookings yet' : 'Nothing here'));
  setTab(t: string) { this.tab.set(t as Tab); this.page.set(1); }
  onChanged(b: Booking) { this.selected.set(b); this.res.reload(); this.base.reload(); }
}
