import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin, switchMap } from 'rxjs';
import { AvailabilityRepository, BookingRepository, PhotographerWorkspaceRepository } from '../../core/api/repositories';
import { Booking } from '../../core/models';
import { addDays, formatDate, startOfMonth, startOfWeek, todayISO } from '../../core/util/dates';
import { isBlocked, rangesForDate } from '../../core/util/availability';
import { SeoService } from '../../core/seo.service';
import { BookingDetailComponent } from '../../shared/bookings/booking-detail.component';
import { BadgeComponent } from '../../shared/ui/badges';
import { IconComponent } from '../../shared/ui/icon.component';
import { DayMark, MonthCalendarComponent } from '../../shared/ui/month-calendar.component';
import { ModalComponent } from '../../shared/ui/modal.component';
import { ErrorStateComponent, PageHeaderComponent } from '../../shared/ui/misc';

type View = 'month' | 'week' | 'day';
const ACTIVE = new Set(['pending', 'confirmed', 'completed']);

@Component({
  selector: 'app-studio-calendar',
  imports: [RouterLink, MonthCalendarComponent, BookingDetailComponent, BadgeComponent, IconComponent, ModalComponent, ErrorStateComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <app-page-header title="Calendar" subtitle="Your sessions and pending requests. Grey days are outside your availability.">
    <div class="seg" role="group" aria-label="Calendar view">@for (v of views; track v) { <button type="button" [attr.aria-pressed]="view() === v" (click)="view.set(v)">{{ v }}</button> }</div>
    <a class="btn btn--outline" routerLink="/studio/availability"><app-icon name="clock" [size]="16" />Edit availability</a>
  </app-page-header>
  <div class="nav row"><button class="btn btn--icon btn--outline" type="button" (click)="shift(-1)" aria-label="Previous"><app-icon name="chevron-left" /></button><button class="btn btn--sm btn--outline" type="button" (click)="today()">Today</button><button class="btn btn--icon btn--outline" type="button" (click)="shift(1)" aria-label="Next"><app-icon name="chevron-right" /></button><h2 aria-live="polite">{{ title() }}</h2></div>
  @if (res.error()) { <app-error-state [error]="res.error()" (retry)="res.reload()" /> }
  @else if (!res.value()) { <div class="skeleton" style="height: 420px"></div> }
  @else {
    @switch (view()) {
      @case ('month') { <div class="mw"><app-month-calendar [month]="monthStart()" [selected]="date()" [marks]="marks()" [isDisabled]="never" (picked)="date.set($event)" (monthChange)="date.set($event)" />
        <section class="card"><div class="card__head"><h3>{{ fmt(date()) }}</h3></div>@if (dayList(date()).length) { <ul>@for (b of dayList(date()); track b.id) { <li><button type="button" (click)="open.set(b)"><strong>{{ b.startTime }}–{{ b.endTime }}</strong><span>{{ b.serviceTitle }} · {{ b.customerName }}</span><app-badge [status]="b.status" /></button></li> }</ul> } @else { <p class="muted pad">{{ hoursText(date()) }}</p> }</section></div> }
      @case ('week') { <div class="wk">@for (d of week(); track d) { <section class="card col" [class.today]="d === todayStr"><h3>{{ fmt(d, true) }}</h3><p class="muted xs">{{ hoursText(d) }}</p>@for (b of dayList(d); track b.id) { <button type="button" class="ev" [class.pend]="b.status === 'pending'" (click)="open.set(b)"><strong>{{ b.startTime }}</strong> {{ b.serviceTitle }}<br /><span class="xs">{{ b.customerName }}</span></button> } @empty { <span class="muted xs">Free</span> }</section> }</div> }
      @case ('day') { <section class="card"><div class="card__head"><h3>{{ fmt(date()) }}</h3><span class="muted small">{{ hoursText(date()) }}</span></div>@if (dayList(date()).length) { <ul>@for (b of dayList(date()); track b.id) { <li><button type="button" (click)="open.set(b)"><strong>{{ b.startTime }}–{{ b.endTime }}</strong><span>{{ b.serviceTitle }} · {{ b.customerName }} · {{ b.location.city }}</span><app-badge [status]="b.status" /></button></li> }</ul> } @else { <p class="muted pad">No sessions this day.</p> }</section> }
    }
  }
  <app-modal [open]="!!open()" label="Booking details" [wide]="true" (closed)="open.set(null)">@if (open(); as b) { <app-booking-detail [booking]="b" role="photographer" (changed)="open.set($event); res.reload()" /> }</app-modal>`,
  styles: `.seg { display: inline-flex; border: 1px solid var(--c-border-strong); border-radius: 10px; overflow: hidden; background: var(--c-surface); } .seg button { padding: 0 14px; height: 40px; border: 0; background: transparent; cursor: pointer; font-weight: 600; font-size: 13px; text-transform: capitalize; } .seg [aria-pressed='true'] { background: var(--c-ink-bg); color: #fff; }
  .nav { margin-bottom: 16px; gap: 8px; align-items: center; } h2 { font-size: 1.3rem; margin-left: 8px; } h3 { font-size: 1.05rem; } .mw { display: grid; grid-template-columns: minmax(300px, 420px) 1fr; gap: 16px; align-items: start; } @media (max-width: 860px) { .mw { grid-template-columns: minmax(0, 1fr); } }
  ul li + li { border-top: 1px solid var(--c-border); } li button { width: 100%; display: grid; grid-template-columns: 110px 1fr auto; gap: 10px; align-items: center; padding: 12px 20px; background: none; border: 0; text-align: left; cursor: pointer; } li button:hover { background: var(--c-surface-2); } .pad { padding: 20px; }
  .wk { display: grid; grid-template-columns: repeat(7, minmax(130px, 1fr)); gap: 8px; overflow-x: auto; } .col { padding: 12px; display: flex; flex-direction: column; gap: 6px; min-height: 220px; } .col.today { border-color: var(--c-primary-600); } .ev { text-align: left; border: 0; border-left: 3px solid var(--c-success); background: var(--c-surface-2); border-radius: 6px; padding: 6px 8px; font-size: 12px; cursor: pointer; } .ev.pend { border-left-color: var(--c-warning); }`,
})
export class StudioCalendarPage {
  private ws = inject(PhotographerWorkspaceRepository); private bookings = inject(BookingRepository); private avail = inject(AvailabilityRepository);
  readonly views: View[] = ['month', 'week', 'day']; readonly view = signal<View>('month'); readonly date = signal(todayISO()); readonly open = signal<Booking | null>(null); readonly todayStr = todayISO(); readonly never = () => false;
  readonly res = rxResource({ stream: () => this.ws.myProfile().pipe(switchMap(p => forkJoin({ bookings: this.bookings.list({ page: 1, pageSize: 500 }), rules: this.avail.rules(p.id) }))) });
  constructor() { inject(SeoService).set('Calendar'); }
  readonly monthStart = computed(() => startOfMonth(this.date())); readonly week = computed(() => { const s = startOfWeek(this.date()); return Array.from({ length: 7 }, (_, i) => addDays(s, i)); });
  private byDate = computed(() => { const m = new Map<string, Booking[]>(); for (const b of this.res.value()?.bookings.items ?? []) if (ACTIVE.has(b.status)) m.set(b.date, [...(m.get(b.date) ?? []), b]); for (const l of m.values()) l.sort((a, b) => a.startTime.localeCompare(b.startTime)); return m; });
  readonly dayList = (d: string) => this.byDate().get(d) ?? [];
  readonly marks = computed<Record<string, DayMark>>(() => { const o: Record<string, DayMark> = {}; for (const [d, l] of this.byDate()) o[d] = { count: l.length, tone: l.some(b => b.status === 'pending') ? 'warning' : 'success', title: `${l.length} booking(s)` }; return o; });
  hoursText(d: string) { const r = this.res.value()?.rules; if (!r) return ''; if (isBlocked(r, d)) return 'Time off'; const g = rangesForDate(r, d); return g.length ? g.map(x => `${x.start}–${x.end}`).join(', ') : 'Not available'; }
  fmt(d: string, short = false) { return formatDate(d, short ? { weekday: 'short', day: 'numeric', month: 'short' } : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  readonly title = computed(() => this.view() === 'month' ? formatDate(this.monthStart(), { month: 'long', year: 'numeric' }) : this.view() === 'week' ? `${this.fmt(this.week()[0], true)} – ${this.fmt(this.week()[6], true)}` : this.fmt(this.date()));
  shift(n: number) { const d = this.date(); if (this.view() === 'month') { const m = new Date(d + 'T00:00:00'); m.setMonth(m.getMonth() + n, 1); this.date.set(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-01`); } else this.date.set(addDays(d, n * (this.view() === 'week' ? 7 : 1))); }
  today() { this.date.set(todayISO()); }
}
