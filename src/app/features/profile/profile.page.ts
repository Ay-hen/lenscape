import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { AdminRepository, AvailabilityRepository, CatalogRepository, MessagingRepository } from '../../core/api/repositories';
import { AuthService } from '../../core/auth/auth.service';
import { ISODate, Service, ServicePackage } from '../../core/models';
import { FavoritesStore, RecentlyViewedStore } from '../../core/state/stores';
import { SeoService } from '../../core/seo.service';
import { addDays, formatDate, monthGrid, startOfMonth, todayISO } from '../../core/util/dates';
import { CATEGORIES_BY_ID } from '../../core/util/categories';
import { GEAR_KINDS } from '../../core/util/gear';
import { errorText } from '../../core/util/forms';
import { formatMoney, priceLabel } from '../../core/util/price';
import { PackageCardComponent } from '../../shared/cards/package-card.component';
import { PhotographerCardComponent } from '../../shared/cards/photographer-card.component';
import { TierBadgeComponent } from '../../shared/ui/badges';
import { IconComponent } from '../../shared/ui/icon.component';
import { ModalComponent } from '../../shared/ui/modal.component';
import { DayMark, MonthCalendarComponent } from '../../shared/ui/month-calendar.component';
import { ErrorStateComponent, RatingComponent } from '../../shared/ui/misc';
import { ToastService } from '../../shared/services/overlay.services';

@Component({
  selector: 'app-profile',
  imports: [RouterLink, FormsModule, IconComponent, PackageCardComponent, PhotographerCardComponent, ModalComponent, MonthCalendarComponent, ErrorStateComponent, RatingComponent, TierBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
})
export class ProfilePage {
  readonly id = input.required<string>();
  private catalog = inject(CatalogRepository); private avail = inject(AvailabilityRepository); private admin = inject(AdminRepository); private msgs = inject(MessagingRepository);
  private auth = inject(AuthService); private router = inject(Router); private toast = inject(ToastService); private seo = inject(SeoService); private recent = inject(RecentlyViewedStore);
  readonly fav = inject(FavoritesStore); readonly cat = CATEGORIES_BY_ID; readonly today = todayISO();

  readonly data = rxResource({
    params: () => this.id(),
    // Only the profile itself is essential. If a secondary section fails (reviews, similar photographers, availability rules...) the page still opens with the rest.
    stream: ({ params }) => forkJoin({
      profile: this.catalog.photographer(params),
      services: this.catalog.services(params).pipe(catchError(() => of([] as Service[]))),
      packages: this.catalog.packages(params).pipe(catchError(() => of([] as ServicePackage[]))),
      reviews: this.catalog.reviews(params).pipe(catchError(() => of([]))),
      similar: this.catalog.similar(params).pipe(catchError(() => of([]))),
      rules: this.avail.rules(params).pipe(catchError(() => of(null))),
    }),
  });
  readonly profile = computed(() => this.data.value()?.profile);
  /** Equipment grouped by kind. Empty unless the photographer chose to show it. */
  readonly gearGroups = computed(() => { const p = this.profile(); if (!p?.showGear) return []; return GEAR_KINDS.map(k => ({ ...k, items: p.gear.filter(g => g.kind === k.kind) })).filter(g => g.items.length); });
  /** Only shops have a public, exact position worth linking to. */
  readonly shopLinks = computed(() => { const p = this.profile(); if (!p || p.workMode !== 'shop') return null; const { lat, lng } = p.publicLocation; return { directions: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, osm: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}` }; }); readonly services = computed(() => this.data.value()?.services ?? []); readonly packages = computed(() => this.data.value()?.packages ?? []);
  readonly reviews = computed(() => this.data.value()?.reviews ?? []);

  readonly serviceId = signal<string | null>(null); readonly selectedPkg = signal<string | null>(null); readonly compareMode = signal(false);
  readonly activeService = computed<Service | undefined>(() => this.services().find(s => s.id === this.serviceId()) ?? this.services()[0]);
  readonly servicePackages = computed(() => this.packages().filter(p => p.serviceId === this.activeService()?.id).sort((a, b) => (a.price ?? 0) - (b.price ?? 0)));
  readonly startText = computed(() => { const ps = this.packages().filter(p => p.price != null); const s = this.activeService(); if (!ps.length || !s) return 'Custom quote'; const min = Math.min(...ps.map(p => p.price!)); return s.pricingModel === 'hourly' ? `${formatMoney(min)} / hour` : `From ${formatMoney(min)}`; });

  readonly album = signal<string>('all');
  readonly portfolio = computed(() => (this.profile()?.portfolio ?? []).filter(i => i.visible && (this.album() === 'all' || i.albumId === this.album())).sort((a, b) => a.order - b.order));
  readonly lightbox = signal<number | null>(null);
  readonly lbImage = computed(() => { const i = this.lightbox(); return i == null ? null : this.portfolio()[i] ?? null; });

  // availability preview
  readonly month = signal<ISODate>(startOfMonth(todayISO())); readonly day = signal<ISODate | null>(null);
  private minDuration = computed(() => Math.min(120, ...this.servicePackages().map(p => p.durationMinutes)));
  readonly open = rxResource({ params: () => ({ id: this.id(), month: this.month(), dur: this.minDuration() }), stream: ({ params }) => (Number.isFinite(params.dur) ? this.avail.openDays(params.id, monthGrid(params.month), params.dur) : of([] as ISODate[])) });
  readonly marks = computed<Record<ISODate, DayMark>>(() => Object.fromEntries((this.open.value() ?? []).map(d => [d, { tone: 'success' as const, title: 'Available' }])));
  readonly slots = rxResource({ params: () => (this.day() ? { id: this.id(), day: this.day()!, dur: this.minDuration() } : null), stream: ({ params }) => (params ? this.avail.slots(params.id, params.day, params.dur) : of([])) });
  readonly disabledDay = computed(() => { const open = new Set(this.open.value() ?? []); return (d: ISODate) => !open.has(d); });

  readonly selectedName = computed(() => this.packages().find(k => k.id === this.selectedPkg())?.name ?? '');
  readonly minDurationLabel = computed(() => { const m = this.minDuration(); return Number.isFinite(m) ? `${m / 60}-hour` : ''; });
  readonly reportOpen = signal(false); readonly reportText = signal(''); readonly reportBusy = signal(false);
  readonly avg = computed(() => this.profile()?.rating ?? 0);

  constructor() {
    effect(() => {
      const p = this.profile(); if (!p) return;
      untracked(() => { this.seo.set(p.displayName, `${p.headline}. ${p.bio.slice(0, 140)}`, p.coverUrl); this.recent.add(p.id); this.catalog.recordView(p.id).subscribe({ error: () => undefined }); });
    });
    effect(() => { const s = this.services()[0]; if (s && !this.serviceId()) untracked(() => this.serviceId.set(s.id)); });
  }

  price(p: ServicePackage) { const s = this.services().find(x => x.id === p.serviceId); return s?.pricingModel === 'quote' || p.price == null ? 'Custom quote' : formatMoney(p.price, p.currency) + (s?.pricingModel === 'hourly' ? ' / hour' : ''); }
  modelOf(p: ServicePackage) { return this.services().find(s => s.id === p.serviceId)?.pricingModel ?? 'fixed'; }
  pickService(id: string) { this.serviceId.set(id); this.selectedPkg.set(null); }
  bookQuery(pkg?: ServicePackage) { return { service: this.activeService()?.id, package: pkg?.id ?? this.selectedPkg() ?? undefined, date: this.day() ?? undefined, slot: undefined as string | undefined }; }
  lb(delta: number) { const n = this.portfolio().length; const i = this.lightbox(); if (i != null && n) this.lightbox.set((i + delta + n) % n); }
  fmt(d: ISODate) { return formatDate(d); }
  dayLabel(n: number) { return addDays(this.today, n); }
  priceOf(info: Parameters<typeof priceLabel>[0]) { return priceLabel(info); }

  async share() {
    const url = location.href; const p = this.profile(); if (!p) return;
    try { if (navigator.share) await navigator.share({ title: p.displayName, url }); else { await navigator.clipboard.writeText(url); this.toast.success('Link copied to clipboard.'); } } catch { /* user cancelled */ }
  }
  message() {
    const p = this.profile(); if (!p) return;
    if (this.auth.role() !== 'client') { void this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } }); return; }
    this.msgs.start(p.id).subscribe({ next: () => void this.router.navigate(['/account/messages']), error: e => this.toast.error(errorText(e)) });
  }
  submitReport() {
    const p = this.profile(); if (!p) return; this.reportBusy.set(true);
    this.admin.report('profile', p.id, p.displayName, this.reportText()).subscribe({ next: () => { this.reportBusy.set(false); this.reportOpen.set(false); this.reportText.set(''); this.toast.success('Thanks — our team will review this profile.'); }, error: e => { this.reportBusy.set(false); this.toast.error(errorText(e)); } });
  }
}
