import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin, map, switchMap } from 'rxjs';
import { CatalogRepository, PhotographerWorkspaceRepository } from '../../core/api/repositories';
import { Service } from '../../core/models';
import { CATEGORIES_BY_ID } from '../../core/util/categories';
import { errorText } from '../../core/util/forms';
import { sceneImage } from '../../core/util/images';
import { PRICING_MODEL_LABEL, formatMoney } from '../../core/util/price';
import { SeoService } from '../../core/seo.service';
import { BadgeComponent } from '../../shared/ui/badges';
import { IconComponent } from '../../shared/ui/icon.component';
import { EmptyStateComponent, ErrorStateComponent, PageHeaderComponent } from '../../shared/ui/misc';
import { ConfirmService, ToastService } from '../../shared/services/overlay.services';

@Component({
  selector: 'app-studio-services',
  imports: [RouterLink, BadgeComponent, IconComponent, EmptyStateComponent, ErrorStateComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <app-page-header title="Services" subtitle="What you offer. Each service has its own pricing model and packages."><a class="btn btn--primary" routerLink="/studio/services/new"><app-icon name="plus" [size]="16" />New service</a></app-page-header>
  @if (res.error()) { <app-error-state [error]="res.error()" (retry)="res.reload()" /> }
  @else if (!res.value()) { <div class="skeleton" style="height: 260px"></div> }
  @else if (!res.value()!.services.length) { <app-empty-state icon="camera" title="No services yet" text="Create your first service, then add Bronze/Silver/Gold/Platinum packages to it." actionLabel="Create a service" actionLink="/studio/services/new" /> }
  @else {
    <div class="grid grid--2">@for (s of res.value()!.services; track s.id) {
      <article class="card sv"><img [src]="cover(s)" alt="" loading="lazy" />
        <div class="b"><div class="row between"><h3>{{ s.title }}</h3><app-badge [status]="s.status" /></div>
          @if (s.moderation !== 'ok') { <p class="notice notice--warn small" role="status"><app-icon name="shield-alert" [size]="16" />{{ s.moderation === 'hidden' ? 'Hidden by moderators' : 'Under review after a report' }}</p> }
          <p class="muted small">{{ cat(s.categoryId) }} · {{ model(s) }} · {{ price(s) }} · {{ s.durationMinutes / 60 }} h</p>
          <p class="muted small">{{ res.value()!.counts[s.id] ?? 0 }} package(s)</p>
          <div class="row"><a class="btn btn--sm btn--outline" [routerLink]="['/studio/services', s.id]">Edit</a><a class="btn btn--sm btn--outline" routerLink="/studio/packages" [queryParams]="{ service: s.id }">Packages</a>
            @if (s.status !== 'published') { <button class="btn btn--sm btn--primary" type="button" (click)="setStatus(s, 'published')">Show</button> }
            @if (s.status === 'published') { <button class="btn btn--sm btn--ghost" type="button" (click)="setStatus(s, 'draft')">Hide</button> }
            @if (s.status !== 'archived') { <button class="btn btn--sm btn--ghost" type="button" (click)="archive(s)">Archive</button> }</div></div></article> }</div>
  }`,
  styles: `.sv { overflow: hidden; display: grid; grid-template-columns: 140px 1fr; } .sv img { width: 100%; height: 100%; object-fit: cover; min-height: 170px; } .b { padding: 16px; display: flex; flex-direction: column; gap: 8px; } h3 { font-size: 1.1rem; } .between { justify-content: space-between; align-items: flex-start; } @media (max-width: 520px) { .sv { grid-template-columns: minmax(0, 1fr); } .sv img { height: 140px; } }`,
})
export class StudioServicesPage {
  private ws = inject(PhotographerWorkspaceRepository); private catalog = inject(CatalogRepository); private toast = inject(ToastService); private confirm = inject(ConfirmService);
  readonly res = rxResource({
    stream: () => this.ws.myProfile().pipe(switchMap(p => forkJoin({ services: this.catalog.services(p.id, { includeUnpublished: true }), pk: this.catalog.packages(p.id, { includeUnpublished: true }) }).pipe(map(({ services, pk }) => ({ services, counts: pk.reduce<Record<string, number>>((m, k) => ({ ...m, [k.serviceId]: (m[k.serviceId] ?? 0) + 1 }), {}) }))))),
  });
  constructor() { inject(SeoService).set('Services'); }
  readonly cover = (s: Service) => s.coverImage || sceneImage(s.id, 400, 400);
  readonly cat = (id: string) => CATEGORIES_BY_ID[id] ?? id; readonly model = (s: Service) => PRICING_MODEL_LABEL[s.pricingModel];
  readonly price = (s: Service) => (s.pricingModel === 'quote' || s.basePrice == null ? 'Custom quote' : formatMoney(s.basePrice, s.currency) + (s.pricingModel === 'hourly' ? '/h' : ''));
  setStatus(s: Service, status: Service['status']) { this.ws.setServiceStatus(s.id, status).subscribe({ next: () => { this.toast.success(status === 'published' ? 'Service is visible again.' : 'Service hidden.'); this.res.reload(); }, error: e => this.toast.error(errorText(e)) }); }
  async archive(s: Service) { const r = await this.confirm.ask({ title: `Archive “${s.title}”?`, message: 'It disappears from your public profile. Existing bookings are not affected.', confirmText: 'Archive', danger: true }); if (r.ok) this.setStatus(s, 'archived'); }
}