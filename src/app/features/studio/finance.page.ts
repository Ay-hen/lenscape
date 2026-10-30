import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { BookingRepository } from '../../core/api/repositories';
import { Booking } from '../../core/models';
import { addDays, formatDate, todayISO } from '../../core/util/dates';
import { formatMoney } from '../../core/util/price';
import { SeoService } from '../../core/seo.service';
import { BarChartComponent, DonutChartComponent, HBarListComponent } from '../../shared/charts/charts';
import { BadgeComponent } from '../../shared/ui/badges';
import { IconComponent } from '../../shared/ui/icon.component';
import { ErrorStateComponent, PageHeaderComponent, StatCardComponent } from '../../shared/ui/misc';
import { ToastService } from '../../shared/services/overlay.services';

const RANGES = [{ id: '30', label: '30 days', days: 30 }, { id: '90', label: '90 days', days: 90 }, { id: '365', label: '12 months', days: 365 }, { id: 'all', label: 'All time', days: 3650 }];
const csvCell = (v: string | number) => { let s = String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

/** Finance view computed from bookings. Payments are NOT processed in this prototype, so "paid" reflects bookkeeping only. */
@Component({
  selector: 'app-studio-finance',
  imports: [BarChartComponent, DonutChartComponent, HBarListComponent, BadgeComponent, IconComponent, ErrorStateComponent, PageHeaderComponent, StatCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <app-page-header title="Finance" subtitle="Earnings from confirmed and completed sessions.">
    <div class="seg" role="group" aria-label="Date range">@for (r of ranges; track r.id) { <button type="button" [attr.aria-pressed]="range() === r.id" (click)="range.set(r.id)">{{ r.label }}</button> }</div>
    <button class="btn btn--outline" type="button" [disabled]="!rows().length" (click)="csv()"><app-icon name="download" [size]="16" />Export CSV</button>
  </app-page-header>
  <div class="notice notice--info" role="note"><app-icon name="info" [size]="18" />Online payments are not connected yet. “Paid” means a payment was <em>recorded</em> against the booking; no money moves through this app. Platform fees are shown as estimates of the commission that will apply.</div>
  @if (res.error()) { <app-error-state [error]="res.error()" (retry)="res.reload()" /> }
  @else if (!res.value()) { <div class="skeleton" style="height: 300px"></div> }
  @else {
    <div class="grid grid--4 st">
      <app-stat-card label="Gross booking value" [value]="m(t().gross)" icon="banknote" [hint]="rows().length + ' bookings'" />
      <app-stat-card label="Platform fees (est.)" [value]="m(t().fee)" icon="percent" hint="Deducted from your gross" />
      <app-stat-card label="Net earnings (est.)" [value]="m(t().gross - t().fee - t().refunded)" icon="wallet" hint="After fees and refunds" />
      <app-stat-card label="Awaiting payment" [value]="m(t().unpaid)" icon="hourglass" hint="Confirmed, not yet recorded as paid" [trend]="t().unpaid ? 'down' : null" />
      <app-stat-card label="Recorded as paid" [value]="m(t().paid)" icon="check-circle" hint="Bookkeeping only" />
      <app-stat-card label="Refunded" [value]="m(t().refunded)" icon="undo" hint="Full or partial" />
      <app-stat-card label="Average booking" [value]="m(rows().length ? t().gross / rows().length : 0)" icon="calculator" hint="Per session" />
      <app-stat-card label="Discounts given" [value]="m(t().discount)" icon="tag" hint="Promo codes" />
    </div>
    <div class="two">
      <section class="card"><div class="card__head"><h3>Revenue by month</h3></div><div class="card__body"><app-bar-chart [data]="monthly()" label="Revenue by month" suffix=" MAD" /></div></section>
      <section class="card"><div class="card__head"><h3>Payment status</h3></div><div class="card__body"><app-donut-chart [data]="payDonut()" label="Payment status" centerLabel="bookings" /></div></section>
    </div>
    <div class="two">
      <section class="card"><div class="card__head"><h3>By service</h3></div><div class="card__body"><app-hbar-list [data]="byService()" label="Revenue by service" suffix=" MAD" /></div></section>
      <section class="card"><div class="card__head"><h3>By package</h3></div><div class="card__body"><app-hbar-list [data]="byPackage()" label="Revenue by package" suffix=" MAD" /></div></section>
    </div>
    <section class="card"><div class="card__head"><h3>Transactions</h3></div><div class="tw"><table class="table"><caption class="sr-only">Bookings with amounts</caption><thead><tr><th>Date</th><th>Reference</th><th>Customer</th><th>Service · package</th><th class="r">Total</th><th class="r">Fee</th><th>Payment</th></tr></thead><tbody>
      @for (b of rows().slice(0, 50); track b.id) { <tr><td>{{ fmt(b.date) }}</td><td>{{ b.reference }}</td><td>{{ b.customerName }}</td><td>{{ b.serviceTitle }} · {{ b.packageName }}</td><td class="r tnum">{{ m(b.pricing.total) }}</td><td class="r tnum">{{ m(b.pricing.platformFee) }}</td><td><app-badge [status]="b.paymentStatus" /></td></tr> } @empty { <tr><td colspan="7" class="muted">No bookings in this period.</td></tr> }</tbody></table></div>
      @if (rows().length > 50) { <p class="muted small pad">Showing the latest 50 of {{ rows().length }}. The CSV export contains all of them.</p> }</section>
  }`,
  styles: `.seg { display: inline-flex; border: 1px solid var(--c-border-strong); border-radius: 10px; overflow: hidden; background: var(--c-surface); } .seg button { padding: 0 14px; height: 40px; border: 0; background: transparent; cursor: pointer; font-weight: 600; font-size: 13px; } .seg [aria-pressed='true'] { background: var(--c-ink-bg); color: #fff; }
  .notice { margin-bottom: 18px; } .st { margin-bottom: 20px; } .two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; margin-bottom: 16px; } @media (max-width: 860px) { .two { grid-template-columns: minmax(0, 1fr); } } h3 { font-size: 1.1rem; } .tw { overflow-x: auto; } .r { text-align: right; } .pad { padding: 12px 20px; }`,
})
export class StudioFinancePage {
  private bookings = inject(BookingRepository); private toast = inject(ToastService);
  readonly ranges = RANGES; readonly range = signal('90');
  readonly res = rxResource({ stream: () => this.bookings.list({ page: 1, pageSize: 1000 }) });
  constructor() { inject(SeoService).set('Finance'); }
  readonly m = (n: number) => formatMoney(Math.round(n), 'MAD'); readonly fmt = (d: string) => formatDate(d, { day: 'numeric', month: 'short', year: 'numeric' });
  readonly rows = computed<Booking[]>(() => { const from = addDays(todayISO(), -RANGES.find(r => r.id === this.range())!.days); return (this.res.value()?.items ?? []).filter(b => (b.status === 'confirmed' || b.status === 'completed') && b.date >= from).sort((a, b) => b.date.localeCompare(a.date)); });
  readonly t = computed(() => {
    const r = this.rows(); const sum = (f: (b: Booking) => number) => r.reduce((s, b) => s + f(b), 0);
    return { gross: sum(b => b.pricing.total), fee: sum(b => b.pricing.platformFee), discount: sum(b => b.pricing.discount), paid: sum(b => (b.paymentStatus === 'paid' ? b.pricing.total : 0)), unpaid: sum(b => (b.paymentStatus === 'unpaid' || b.paymentStatus === 'pending' ? b.pricing.total : 0)),
      refunded: sum(b => (b.paymentStatus === 'refunded' ? b.pricing.total : b.paymentStatus === 'partially_refunded' ? b.pricing.total * ((b.cancellation?.refundPercent ?? 50) / 100) : 0)) };
  });
  readonly monthly = computed(() => { const mm = new Map<string, number>(); for (const b of this.rows()) mm.set(b.date.slice(0, 7), (mm.get(b.date.slice(0, 7)) ?? 0) + b.pricing.total); return [...mm.entries()].sort().map(([k, v]) => ({ label: new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(new Date(k + '-01')), value: Math.round(v) })); });
  private group(key: (b: Booking) => string) { const mm = new Map<string, number>(); for (const b of this.rows()) mm.set(key(b), (mm.get(key(b)) ?? 0) + b.pricing.total); return [...mm.entries()].map(([label, value]) => ({ label, value: Math.round(value) })).sort((a, b) => b.value - a.value).slice(0, 8); }
  readonly byService = computed(() => this.group(b => b.serviceTitle)); readonly byPackage = computed(() => this.group(b => `${b.packageName} (${b.tier})`));
  readonly payDonut = computed(() => { const c: Record<string, number> = {}; for (const b of this.rows()) c[b.paymentStatus] = (c[b.paymentStatus] ?? 0) + 1; return Object.entries(c).map(([label, value]) => ({ label: label.replace('_', ' '), value })); });
  csv() {
    const head = ['Date', 'Reference', 'Customer', 'Service', 'Package', 'Status', 'Payment', 'Subtotal', 'Discount', 'Platform fee', 'Total', 'Currency'];
    const lines = [head, ...this.rows().map(b => [b.date, b.reference, b.customerName, b.serviceTitle, b.packageName, b.status, b.paymentStatus, b.pricing.subtotal, b.pricing.discount, b.pricing.platformFee, b.pricing.total, b.pricing.currency])].map(r => r.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + lines], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = `finance-${todayISO()}.csv`; a.click(); URL.revokeObjectURL(url); this.toast.success('CSV downloaded.');
  }
}
