import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AdminRepository } from '../../core/api/repositories';
import { ContentReport, Service } from '../../core/models';
import { CATEGORIES_BY_ID } from '../../core/util/categories';
import { timeAgo } from '../../core/util/dates';
import { errorText } from '../../core/util/forms';
import { PRICING_MODEL_LABEL, formatMoney } from '../../core/util/price';
import { SeoService } from '../../core/seo.service';
import { BadgeComponent, TierBadgeComponent } from '../../shared/ui/badges';
import { TabsComponent } from '../../shared/ui/tabs.component';
import { EmptyStateComponent, ErrorStateComponent, PageHeaderComponent } from '../../shared/ui/misc';
import { ConfirmService, ToastService } from '../../shared/services/overlay.services';

@Component({
  selector: 'app-admin-moderation',
  imports: [BadgeComponent, TierBadgeComponent, TabsComponent, EmptyStateComponent, ErrorStateComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <app-page-header title="Listings moderation" subtitle="Hide listings that break the rules and handle user reports." />
  <app-tabs [tabs]="tabs()" [active]="tab()" label="Moderation sections" (changed)="tab.set($event)" />
  @if (res.error()) { <app-error-state [error]="res.error()" (retry)="res.reload()" /> }
  @else if (!res.value()) { <div class="skeleton" style="height: 280px"></div> }
  @else { @let v = res.value()!;
    @switch (tab()) {
      @case ('reports') { @if (!reports().length) { <app-empty-state icon="shield-check" title="No open reports" text="Reports from users will appear here." /> } @else { <div class="stack">@for (r of reports(); track r.id) {
        <article class="card card--pad rep"><div class="grow"><div class="row"><strong>{{ r.targetLabel }}</strong><span class="chip">{{ r.targetType }}</span></div><p class="small">{{ r.reason }}</p><span class="muted xs">Reported by {{ r.reportedBy }} · {{ ago(r.at) }}</span></div>
          <div class="row"><button class="btn btn--sm btn--ghost" type="button" (click)="resolve(r, 'dismissed')">Dismiss</button><button class="btn btn--sm btn--primary" type="button" (click)="resolve(r, 'actioned')">Mark actioned</button></div></article> }</div> } }
      @case ('services') { <div class="card tw"><table class="table"><caption class="sr-only">Services</caption><thead><tr><th>Service</th><th>Photographer</th><th>Category</th><th>Pricing</th><th>Status</th><th>Visibility</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>
        @for (s of v.services; track s.id) { <tr><td><strong>{{ s.title }}</strong>@if (s.featured) { <span class="chip">Featured</span> }</td><td>{{ name(s.photographerId) }}</td><td>{{ cat(s.categoryId) }}</td><td>{{ model(s) }} · {{ price(s) }}</td><td><app-badge [status]="s.status" /></td><td><app-badge [status]="s.moderation" /></td>
          <td class="acts">@if (s.moderation === 'hidden') { <button class="btn btn--sm btn--outline" type="button" (click)="setMod(s, 'ok')">Restore</button> } @else { <button class="btn btn--sm btn--ghost danger" type="button" (click)="hide(s)">Hide</button> }<button class="btn btn--sm btn--ghost" type="button" (click)="feature(s)">{{ s.featured ? 'Unfeature' : 'Feature' }}</button></td></tr> }</tbody></table></div> }
      @case ('packages') { <p class="muted small">Packages follow their service: hiding a service hides its packages. Packages are read-only here.</p><div class="card tw"><table class="table"><caption class="sr-only">Packages</caption><thead><tr><th>Package</th><th>Tier</th><th>Service</th><th>Price</th><th>Status</th></tr></thead><tbody>
        @for (k of v.packages; track k.id) { <tr><td><strong>{{ k.name }}</strong></td><td><app-tier-badge [tier]="k.tier" /></td><td>{{ svcTitle(k.serviceId) }}</td><td class="tnum">{{ k.price == null ? 'Custom quote' : money(k.price) }}</td><td><app-badge [status]="k.status" /></td></tr> }</tbody></table></div> }
    }
    @if (error()) { <div class="notice notice--error" role="alert">{{ error() }}</div> }
  }`,
  styles: `app-tabs { display: block; margin-bottom: 16px; } .rep { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; } .tw { overflow-x: auto; } .acts { white-space: nowrap; text-align: right; } .danger { color: var(--c-error); }`,
})
export class AdminModerationPage {
  private repo = inject(AdminRepository); private toast = inject(ToastService); private confirm = inject(ConfirmService);
  readonly tab = signal(inject(ActivatedRoute).snapshot.queryParamMap.get('tab') ?? 'reports'); readonly error = signal('');
  readonly res = rxResource({ stream: () => forkJoin({ services: this.repo.allServices(), packages: this.repo.allPackages(), reports: this.repo.reports(), apps: this.repo.applications() }) });
  readonly reports = computed(() => (this.res.value()?.reports ?? []).filter(r => r.state === 'open'));
  readonly tabs = computed(() => [{ id: 'reports', label: 'Reports', count: this.reports().length }, { id: 'services', label: 'Services', count: this.res.value()?.services.length }, { id: 'packages', label: 'Packages', count: this.res.value()?.packages.length }]);
  readonly ago = timeAgo; readonly cat = (id: string) => CATEGORIES_BY_ID[id] ?? id; readonly model = (s: Service) => PRICING_MODEL_LABEL[s.pricingModel]; readonly money = (n: number) => formatMoney(n, 'MAD');
  readonly price = (s: Service) => (s.basePrice == null ? 'Custom quote' : formatMoney(s.basePrice, 'MAD'));
  svcTitle(id: string) { return this.res.value()?.services.find(s => s.id === id)?.title ?? id; }
  name(pid: string) { return this.res.value()?.apps.find(a => a.photographerId === pid)?.displayName ?? pid; }
  constructor() { inject(SeoService).set('Moderation'); }
  private done(msg: string) { return { next: () => { this.toast.success(msg); this.res.reload(); }, error: (e: unknown) => this.toast.error(errorText(e)) }; }
  resolve(r: ContentReport, state: 'dismissed' | 'actioned') { this.repo.resolveReport(r.id, state).subscribe(this.done(state === 'dismissed' ? 'Report dismissed.' : 'Report marked as actioned.')); }
  setMod(s: Service, m: Service['moderation']) { this.repo.moderateService(s.id, m).subscribe(this.done(m === 'ok' ? 'Service restored.' : 'Service hidden.')); }
  async hide(s: Service) { const r = await this.confirm.ask({ title: `Hide “${s.title}”?`, message: 'It disappears from search and the photographer’s public profile until restored.', confirmText: 'Hide listing', danger: true }); if (r.ok) this.setMod(s, 'hidden'); }
  feature(s: Service) { this.repo.moderateService(s.id, s.moderation, !s.featured).subscribe(this.done(s.featured ? 'Removed from featured.' : 'Marked as featured.')); }
}
