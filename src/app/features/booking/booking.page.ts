import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { KeyValuePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { AvailabilityRepository, BookingRepository, CatalogRepository, CustomerRepository, PaymentRepository } from '../../core/api/repositories';
import { ApiError, Booking, GeoPoint, ISODate, Service, ServicePackage } from '../../core/models';
import { GeoResult } from '../../core/geo/geocoding.service';
import { CITY_COORDS } from '../../core/geo/gazetteer';
import { SeoService } from '../../core/seo.service';
import { addDays, formatDate, monthGrid, startOfMonth, todayISO } from '../../core/util/dates';
import { errorText } from '../../core/util/forms';
import { formatMoney } from '../../core/util/price';
import { CATEGORIES_BY_ID } from '../../core/util/categories';
import { PackageCardComponent } from '../../shared/cards/package-card.component';
import { TierBadgeComponent } from '../../shared/ui/badges';
import { IconComponent } from '../../shared/ui/icon.component';
import { DayMark, MonthCalendarComponent } from '../../shared/ui/month-calendar.component';
import { ErrorStateComponent } from '../../shared/ui/misc';
import { LocationPickerComponent } from '../../shared/map/location-picker.component';
import { LocationSearchComponent } from '../../shared/map/location-search.component';
import { ToastService } from '../../shared/services/overlay.services';

const STEPS = ['Package', 'Date & time', 'Location', 'Extras', 'Review'] as const;

@Component({
  selector: 'app-booking',
  imports: [FormsModule, RouterLink, KeyValuePipe, IconComponent, PackageCardComponent, MonthCalendarComponent, ErrorStateComponent, LocationPickerComponent, LocationSearchComponent, TierBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './booking.page.html',
  styleUrl: './booking.page.scss',
})
export class BookingPage {
  readonly id = input.required<string>(); readonly service = input<string>(); readonly package = input<string>(); readonly date = input<string>(); readonly slot = input<string>();
  private catalog = inject(CatalogRepository); private avail = inject(AvailabilityRepository); private bookings = inject(BookingRepository); private customer = inject(CustomerRepository);
  readonly payments = inject(PaymentRepository); private toast = inject(ToastService);
  readonly steps = STEPS; readonly today = todayISO(); readonly cats = CATEGORIES_BY_ID;
  private readonly idemKey = (globalThis.crypto?.randomUUID?.() ?? `bk-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  readonly data = rxResource({ params: () => this.id(), stream: ({ params }) => forkJoin({ profile: this.catalog.photographer(params), services: this.catalog.services(params), packages: this.catalog.packages(params), me: this.customer.getProfile() }) });
  readonly profile = computed(() => this.data.value()?.profile); readonly services = computed(() => this.data.value()?.services ?? []); readonly allPackages = computed(() => this.data.value()?.packages ?? []);
  readonly me = computed(() => this.data.value()?.me);

  readonly step = signal(0); readonly maxStep = signal(0);
  readonly serviceId = signal<string | null>(null); readonly packageId = signal<string | null>(null); readonly hours = signal(2);
  readonly month = signal<ISODate>(startOfMonth(todayISO())); readonly day = signal<ISODate | null>(null); readonly startTime = signal<string | null>(null);
  readonly address = signal(''); readonly city = signal(''); readonly point = signal<GeoPoint | null>(null); readonly category = signal('');
  readonly addOnIds = signal<string[]>([]); readonly promoInput = signal(''); readonly promo = signal(''); readonly notes = signal('');
  readonly accepted = signal(false); readonly submitting = signal(false); readonly formError = signal(''); readonly priceChanged = signal(false); readonly result = signal<Booking | null>(null);

  readonly svc = computed<Service | undefined>(() => this.services().find(s => s.id === this.serviceId()));
  readonly pkgs = computed(() => this.allPackages().filter(p => p.serviceId === this.serviceId()).sort((a, b) => (a.price ?? 0) - (b.price ?? 0)));
  readonly pkg = computed<ServicePackage | undefined>(() => this.allPackages().find(p => p.id === this.packageId()));
  readonly hourly = computed(() => this.svc()?.pricingModel === 'hourly');
  readonly duration = computed(() => (this.hourly() ? this.hours() * 60 : this.pkg()?.durationMinutes ?? 120));
  readonly endTime = computed(() => { const s = this.startTime(); if (!s) return ''; const m = +s.slice(0, 2) * 60 + +s.slice(3) + this.duration(); return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; });

  // availability (server-authoritative)
  readonly open = rxResource({ params: () => (this.pkg() ? { id: this.id(), month: this.month(), dur: this.duration() } : null), stream: ({ params }) => (params ? this.avail.openDays(params.id, monthGrid(params.month), params.dur) : of([] as ISODate[])) });
  readonly slots = rxResource({ params: () => (this.pkg() && this.day() ? { id: this.id(), day: this.day()!, dur: this.duration() } : null), stream: ({ params }) => (params ? this.avail.slots(params.id, params.day, params.dur) : of([])) });
  readonly marks = computed<Record<ISODate, DayMark>>(() => Object.fromEntries((this.open.value() ?? []).map(d => [d, { tone: 'success' as const, title: 'Available' }])));
  readonly disabledDay = computed(() => { const o = new Set(this.open.value() ?? []); return (d: ISODate) => !o.has(d); });
  readonly freeSlots = computed(() => (this.slots.value() ?? []).filter(s => s.available));

  // quote (server-authoritative price)
  readonly quote = rxResource({
    params: () => (this.pkg() ? { photographerId: this.id(), serviceId: this.serviceId()!, packageId: this.packageId()!, addOnIds: this.addOnIds(), promoCode: this.promo() || undefined, hours: this.hourly() ? this.hours() : undefined } : null),
    stream: ({ params }) => (params ? this.bookings.quote(params) : of(null)),
  });
  readonly promoError = computed(() => { const e = this.quote.error(); const err = (e as { cause?: unknown })?.cause ?? e; return err instanceof ApiError && err.details?.['promoCode'] ? err.message : ''; });
  readonly q = computed(() => (this.promoError() ? null : this.quote.value()));
  readonly addOns = computed(() => this.svc()?.addOns ?? []);
  readonly chosenAddOns = computed(() => this.addOns().filter(a => this.addOnIds().includes(a.id)));
  readonly savedLocations = computed(() => this.me()?.savedLocations ?? []);

  constructor() {
    inject(SeoService).set('Book a photographer');
    effect(() => { // prefill from deep links (profile page → /book/:id?service=&package=&date=&slot=)
      const s = this.services(); if (!s.length) return;
      untracked(() => {
        const sv = this.service(); const pk = this.package(); const chosen = s.find(x => x.id === sv) ?? s.find(x => this.allPackages().some(p => p.id === pk && p.serviceId === x.id)) ?? s[0];
        if (!this.serviceId()) { this.serviceId.set(chosen.id); this.category.set(chosen.categoryId); if (chosen.pricingModel === 'hourly') this.hours.set(Math.max(1, Math.round(chosen.durationMinutes / 60 / 2))); }
        if (!this.packageId() && pk && this.allPackages().some(p => p.id === pk && p.serviceId === chosen.id)) { this.packageId.set(pk); this.step.set(1); this.maxStep.set(1); }
        const d = this.date(); if (d && d >= todayISO() && !this.day()) { this.day.set(d); this.month.set(startOfMonth(d)); }
        const sl = this.slot(); if (sl && !this.startTime()) this.startTime.set(sl);
        const p = this.profile(); const me = this.me(); if (!this.city()) this.city.set(me?.city ?? p?.city ?? '');
      });
    });
    effect(() => { const s = this.slots.value(); const t = this.startTime(); if (s && t && !s.some(x => x.start === t && x.available)) untracked(() => this.startTime.set(null)); });
  }

  pickService(s: Service) { this.serviceId.set(s.id); this.packageId.set(null); this.category.set(s.categoryId); this.startTime.set(null); this.addOnIds.set([]); }
  pickPackage(p: ServicePackage) { this.packageId.set(p.id); this.startTime.set(null); }
  setHours(h: number) { this.hours.set(Math.min(12, Math.max(1, h))); this.startTime.set(null); }
  pickDay(d: ISODate) { this.day.set(d); this.startTime.set(null); }
  toggleAddOn(id: string) { this.addOnIds.update(l => (l.includes(id) ? l.filter(x => x !== id) : [...l, id])); }
  applyPromo() { this.promo.set(this.promoInput().trim()); }
  clearPromo() { this.promo.set(''); this.promoInput.set(''); }
  placePicked(r: GeoResult) { this.point.set(r.point); this.address.set(r.label.split(',').slice(0, 3).join(',')); if (r.city) this.city.set(r.city); }
  pickSaved(id: string) { const l = this.savedLocations().find(x => x.id === id); if (l) { this.point.set(l.point); this.address.set(l.address); } }
  mapPoint(): GeoPoint { return this.point() ?? CITY_COORDS[this.city()] ?? this.profile()?.publicLocation ?? { lat: 33.57, lng: -7.59 }; }
  fmtDate(d: ISODate) { return formatDate(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  money(n: number) { return formatMoney(n, 'MAD'); }
  addDays = addDays;

  readonly stepError = computed(() => {
    switch (this.step()) {
      case 0: return !this.pkg() ? 'Choose a package to continue.' : '';
      case 1: return !this.day() || !this.startTime() ? 'Pick a date and an available start time.' : '';
      case 2: return this.address().trim().length < 5 ? 'Enter the event address (at least 5 characters).' : !this.city().trim() ? 'Enter the city.' : '';
      default: return '';
    }
  });
  readonly showStepError = signal(false);
  next() { if (this.stepError()) { this.showStepError.set(true); return; } this.showStepError.set(false); this.go(this.step() + 1); }
  go(i: number) { if (i <= this.maxStep() || i === this.step() + 1) { this.step.set(i); this.maxStep.update(m => Math.max(m, i)); window.scrollTo({ top: 0, behavior: 'smooth' }); } }
  back() { this.showStepError.set(false); this.step.update(s => Math.max(0, s - 1)); }

  submit() {
    const q = this.q(); const p = this.pkg(); const s = this.svc(); const d = this.day(); const t = this.startTime();
    if (this.submitting() || !q || !p || !s || !d || !t || !this.accepted()) return;
    this.submitting.set(true); this.formError.set(''); this.priceChanged.set(false);
    this.bookings.create({ photographerId: this.id(), serviceId: s.id, packageId: p.id, addOnIds: this.addOnIds(), promoCode: this.promo() || undefined, hours: this.hourly() ? this.hours() : undefined, date: d, startTime: t, categoryId: this.category() || s.categoryId, location: { address: this.address().trim(), city: this.city().trim(), point: this.point() ?? undefined }, notes: this.notes().trim(), expectedTotal: q.total, quoteId: q.quoteId, idempotencyKey: this.idemKey }).subscribe({
      next: b => { this.submitting.set(false); this.result.set(b); window.scrollTo({ top: 0, behavior: 'smooth' }); },
      error: (e: unknown) => {
        this.submitting.set(false);
        if (e instanceof ApiError && e.code === 'PRICE_CHANGED') { this.priceChanged.set(true); this.accepted.set(false); this.quote.reload(); this.formError.set(e.message); }
        else if (e instanceof ApiError && e.code === 'SLOT_UNAVAILABLE') { this.formError.set(e.message); this.startTime.set(null); this.slots.reload(); this.open.reload(); this.step.set(1); }
        else this.formError.set(errorText(e));
      },
    });
  }
}
