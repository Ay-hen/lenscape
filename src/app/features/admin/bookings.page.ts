import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { BookingRepository } from '../../core/api/repositories';
import { Booking } from '../../core/models';
import { formatDate } from '../../core/util/dates';
import { formatMoney } from '../../core/util/price';
import { SeoService } from '../../core/seo.service';
import { BookingDetailComponent } from '../../shared/bookings/booking-detail.component';
import { BadgeComponent } from '../../shared/ui/badges';
import { ModalComponent } from '../../shared/ui/modal.component';
import { TabsComponent } from '../../shared/ui/tabs.component';
import { EmptyStateComponent, ErrorStateComponent, PageHeaderComponent, PaginationComponent } from '../../shared/ui/misc';

type Tab = 'all' | 'disputes' | 'resolved' | 'cancelled';

@Component({
  selector: 'app-admin-bookings',
  imports: [BookingDetailComponent, BadgeComponent, ModalComponent, TabsComponent, EmptyStateComponent, ErrorStateComponent, PageHeaderComponent, PaginationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <app-page-header title="Bookings & disputes" subtitle="Every booking on the platform. Open a row to resolve a dispute or record a refund." />
  <div class="card"><div class="tb"><app-tabs [tabs]="tabs()" [active]="tab()" label="Booking filters" (changed)="setTab($event)" /><input class="input" type="search" placeholder="Reference, customer, photographer…" aria-label="Search bookings" (input)="search($any($event.target).value)" /></div>
    @if (res.error()) { <div class="pad"><app-error-state [error]="res.error()" (retry)="res.reload()" /></div> }
    @else if (!res.value()) { <div class="pad"><div class="skeleton" style="height: 260px"></div></div> }
    @else if (!rows().length) { <app-empty-state icon="calendar-check" title="No bookings here" text="Nothing matches this view." /> }
    @else { <div class="tw"><table class="table"><caption class="sr-only">Bookings</caption><thead><tr><th>Reference</th><th>Date</th><th>Customer</th><th>Photographer</th><th>Service</th><th class="r">Total</th><th>Status</th></tr></thead><tbody>
      @for (b of paged(); track b.id) { <tr class="click" tabindex="0" (click)="open.set(b)" (keydown.enter)="open.set(b)"><td><strong>{{ b.reference }}</strong></td><td>{{ fmt(b.date) }}</td><td>{{ b.customerName }}</td><td>{{ b.photographerName }}</td><td>{{ b.serviceTitle }}</td><td class="r tnum">{{ money(b.pricing.total) }}</td><td><div class="row"><app-badge [status]="b.status" />@if (b.dispute?.state === 'open') { <app-badge tone="error">Dispute</app-badge> }</div></td></tr> }</tbody></table></div>
      <div class="pad"><app-pagination [page]="page()" [pageSize]="size" [total]="rows().length" (pageChange)="page.set($event)" /></div> }</div>
  <app-modal [open]="!!open()" label="Booking details" [wide]="true" (closed)="open.set(null)">@if (open(); as b) { <app-booking-detail [booking]="b" role="admin" (changed)="open.set($event); res.reload()" /> }</app-modal>`,
  styles: `.tb { display: flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap; padding: 0 16px; border-bottom: 1px solid var(--c-border); } .tb app-tabs { flex: 1 1 360px; min-width: 0; } .tb .input { width: 280px; margin: 8px 0; max-width: 100%; } .pad { padding: 16px; } .tw { overflow-x: auto; } .r { text-align: right; } .click { cursor: pointer; } .click:hover, .click:focus-visible { background: var(--c-surface-2); }`,
})
export class AdminBookingsPage {
  private repo = inject(BookingRepository);
  readonly tab = signal<Tab>((inject(ActivatedRoute).snapshot.queryParamMap.get('tab') as Tab | null) ?? 'all'); readonly q = signal(''); readonly page = signal(1); readonly size = 15; readonly open = signal<Booking | null>(null);
  readonly res = rxResource({ params: () => this.q(), stream: ({ params }) => this.repo.list({ q: params || undefined, page: 1, pageSize: 1000 }) });
  readonly all = computed(() => (this.res.value()?.items ?? []).slice().sort((a, b) => b.date.localeCompare(a.date)));
  readonly tabs = computed(() => { const a = this.all(); return [{ id: 'all', label: 'All', count: a.length }, { id: 'disputes', label: 'Open disputes', count: a.filter(b => b.dispute?.state === 'open').length }, { id: 'resolved', label: 'Resolved disputes', count: a.filter(b => b.dispute?.state === 'resolved').length }, { id: 'cancelled', label: 'Cancelled', count: a.filter(b => b.status === 'cancelled').length }]; });
  readonly rows = computed(() => this.all().filter(b => ({ all: true, disputes: b.dispute?.state === 'open', resolved: b.dispute?.state === 'resolved', cancelled: b.status === 'cancelled' })[this.tab()]));
  readonly paged = computed(() => this.rows().slice((this.page() - 1) * this.size, this.page() * this.size));
  readonly fmt = (d: string) => formatDate(d, { day: 'numeric', month: 'short', year: 'numeric' }); readonly money = (n: number) => formatMoney(n, 'MAD');
  private t?: ReturnType<typeof setTimeout>;
  constructor() { inject(SeoService).set('Bookings & disputes'); }
  setTab(t: string) { this.tab.set(t as Tab); this.page.set(1); }
  search(v: string) { clearTimeout(this.t); this.t = setTimeout(() => { this.q.set(v.trim()); this.page.set(1); }, 250); }
}
