import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, switchMap } from 'rxjs';
import { CatalogRepository, PhotographerWorkspaceRepository } from '../../core/api/repositories';
import { PackageTier, Service, ServicePackage } from '../../core/models';
import { errorText, touchAll } from '../../core/util/forms';
import { SeoService } from '../../core/seo.service';
import { PackageCardComponent } from '../../shared/cards/package-card.component';
import { FieldComponent } from '../../shared/ui/field.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { ModalComponent } from '../../shared/ui/modal.component';
import { EmptyStateComponent, ErrorStateComponent, PageHeaderComponent } from '../../shared/ui/misc';
import { TierBadgeComponent } from '../../shared/ui/badges';
import { ConfirmService, ToastService } from '../../shared/services/overlay.services';

const TIERS: PackageTier[] = ['bronze', 'silver', 'gold', 'platinum'];
const TIER_HINT: Record<PackageTier, string> = { bronze: 'Entry level', silver: 'Popular choice', gold: 'Most complete', platinum: 'Premium / full day' };

/** Package builder. Tiers are a visual language only — YOU decide price and inclusions for each. */
@Component({
  selector: 'app-studio-packages',
  imports: [ReactiveFormsModule, PackageCardComponent, FieldComponent, IconComponent, ModalComponent, EmptyStateComponent, ErrorStateComponent, PageHeaderComponent, TierBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <app-page-header title="Packages" subtitle="Bronze, Silver, Gold, Platinum — each service can have one package per tier.">
    @if (services().length) { <select class="select" aria-label="Service" [value]="serviceId()" (change)="pick($any($event.target).value)">@for (s of services(); track s.id) { <option [value]="s.id" [selected]="s.id === serviceId()">{{ s.title }}</option> }</select> }
  </app-page-header>
  @if (res.error()) { <app-error-state [error]="res.error()" (retry)="res.reload()" /> }
  @else if (!res.value()) { <div class="skeleton" style="height: 300px"></div> }
  @else if (!services().length) { <app-empty-state icon="layers" title="Create a service first" text="Packages belong to a service." actionLabel="New service" actionLink="/studio/services/new" /> }
  @else if (service(); as svc) {
    @if (svc.pricingModel === 'quote') { <div class="notice notice--info"><app-icon name="info" [size]="18" />This service uses custom quotes, so packages show no price — they describe what each tier includes.</div> }
    @if (svc.pricingModel === 'hourly') { <div class="notice notice--info"><app-icon name="info" [size]="18" />This service is charged per hour. The price on each package is its hourly rate.</div> }
    <div class="grid grid--4 tiers">@for (t of tiers; track t) {
      <div class="slot">@if (byTier()[t]; as k) {
        <app-package-card [pkg]="k" [model]="svc.pricingModel" [status]="k.status">
          <div class="act"><button class="btn btn--sm btn--outline" type="button" (click)="edit(k)">Edit</button><button class="btn btn--sm btn--ghost" type="button" (click)="toggle(k)">{{ k.status === 'published' ? 'Hide' : 'Show' }}</button><button class="btn btn--sm btn--ghost" type="button" (click)="remove(k)" aria-label="Delete package"><app-icon name="trash" [size]="14" /></button></div></app-package-card>
        } @else { <button type="button" class="empty" (click)="create(t)"><app-tier-badge [tier]="t" /><span class="muted small">{{ hint[t] }}</span><span class="btn btn--sm btn--outline"><app-icon name="plus" [size]="14" />Add {{ t }} package</span></button> }</div> }</div>
  }
  <app-modal [open]="editing()" [wide]="true" label="Package editor" (closed)="close()">
    @if (editing()) {
      <div class="ed"><form [formGroup]="form" (ngSubmit)="save()" novalidate class="stack">
        <h2>{{ form.controls.id.value ? 'Edit package' : 'New package' }}</h2>
        <div class="form-grid">
          <app-field label="Name" [control]="form.controls.name" [required]="true"><input class="input" formControlName="name" maxlength="40" /></app-field>
          <app-field label="Tier"><select class="select" formControlName="tier">@for (t of tiers; track t) { <option [value]="t" [disabled]="taken(t)">{{ t }}{{ taken(t) ? ' (in use)' : '' }}</option> }</select></app-field>
          @if (service()?.pricingModel !== 'quote') { <app-field [label]="service()?.pricingModel === 'hourly' ? 'Hourly rate (MAD)' : service()?.pricingModel === 'starting' ? 'Starting price (MAD)' : 'Price (MAD)'" [control]="form.controls.price" [required]="true"><input class="input" type="number" min="0" formControlName="price" /></app-field> }
          <app-field label="Duration (minutes)" [control]="form.controls.durationMinutes"><input class="input" type="number" min="15" step="15" formControlName="durationMinutes" /></app-field>
          <app-field label="Edited photos"><input class="input" type="number" min="0" formControlName="editedPhotos" /></app-field>
          <app-field label="Locations"><input class="input" type="number" min="1" formControlName="locations" /></app-field>
          <app-field label="Outfit changes"><input class="input" type="number" min="0" formControlName="outfitChanges" /></app-field>
          <app-field label="Delivery (days)"><input class="input" type="number" min="1" formControlName="deliveryDays" /></app-field>
        </div>
        <app-field label="Short description" [control]="form.controls.description" [required]="true"><textarea class="textarea" rows="2" formControlName="description"></textarea></app-field>
        <app-field label="What’s included" hint="One per line"><textarea class="textarea" rows="4" formControlName="includes"></textarea></app-field>
        <app-field label="Optional extras" hint="One per line"><textarea class="textarea" rows="2" formControlName="extras"></textarea></app-field>
        <app-field label="Travel conditions"><input class="input" formControlName="travelConditions" /></app-field>
        <app-field label="Booking conditions"><input class="input" formControlName="bookingConditions" /></app-field>
        <label class="check"><input type="checkbox" formControlName="featured" /><span>Mark as “Recommended”</span></label>
        @if (error()) { <div class="notice notice--error" role="alert">{{ error() }}</div> }
        <div class="row"><span class="grow"></span><button type="button" class="btn btn--ghost" (click)="close()">Cancel</button><button class="btn btn--primary" type="submit" [disabled]="busy()">Save package</button></div>
      </form>
      <aside><p class="eyebrow">Live preview</p>@if (preview(); as pv) { <app-package-card [pkg]="pv" [model]="service()?.pricingModel ?? 'fixed'" /> }</aside></div>
    }
  </app-modal>`,
  styles: `.tiers { align-items: stretch; } .slot { display: flex; flex-direction: column; } .slot app-package-card { flex: 1; display: flex; } .act { display: flex; gap: 6px; margin-top: auto; padding-top: 8px; flex-wrap: wrap; } .empty { flex: 1; min-height: 260px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; border: 2px dashed var(--c-border-strong); border-radius: 16px; background: transparent; cursor: pointer; padding: 20px; } .empty:hover { background: var(--c-surface); }
  .ed { display: grid; grid-template-columns: 1fr 320px; gap: 24px; padding: 28px; } .ed aside { position: sticky; top: 0; align-self: start; } h2 { font-size: 1.4rem; } @media (max-width: 860px) { .ed { grid-template-columns: minmax(0, 1fr); padding: 20px 16px; } .ed aside { order: -1; position: static; } }`,
})
export class StudioPackagesPage {
  private ws = inject(PhotographerWorkspaceRepository); private catalog = inject(CatalogRepository); private fb = inject(FormBuilder);
  private toast = inject(ToastService); private confirm = inject(ConfirmService); private route = inject(ActivatedRoute); private router = inject(Router);
  readonly tiers = TIERS; readonly hint = TIER_HINT; readonly editing = signal(false); readonly busy = signal(false); readonly error = signal('');
  readonly res = rxResource({ stream: () => this.ws.myProfile().pipe(switchMap(p => forkJoin({ services: this.catalog.services(p.id, { includeUnpublished: true }), packages: this.catalog.packages(p.id, { includeUnpublished: true }) }))) });
  readonly services = computed<Service[]>(() => (this.res.value()?.services ?? []).filter(s => s.status !== 'archived'));
  readonly serviceId = signal('');
  readonly service = computed<Service | null>(() => this.services().find(s => s.id === this.serviceId()) ?? this.services()[0] ?? null);
  readonly list = computed(() => (this.res.value()?.packages ?? []).filter(k => k.serviceId === this.service()?.id));
  readonly byTier = computed(() => Object.fromEntries(this.list().map(k => [k.tier, k])) as Partial<Record<PackageTier, ServicePackage>>);
  readonly form = this.fb.nonNullable.group({
    id: [''], name: ['', [Validators.required, Validators.minLength(2)]], tier: ['bronze' as PackageTier], price: [null as number | null], durationMinutes: [60, [Validators.required, Validators.min(15)]], editedPhotos: [10, Validators.min(0)], locations: [1, Validators.min(1)], outfitChanges: [0, Validators.min(0)], deliveryDays: [14, Validators.min(1)],
    description: ['', [Validators.required, Validators.minLength(10)]], includes: [''], extras: [''], travelConditions: [''], bookingConditions: [''], featured: [false],
  });
  private formValue = signal(this.form.getRawValue());
  constructor() {
    inject(SeoService).set('Packages');
    this.form.valueChanges.subscribe(() => this.formValue.set(this.form.getRawValue()));
    effect(() => { const q = this.route.snapshot.queryParamMap.get('service'); if (q && !this.serviceId()) this.serviceId.set(q); });
  }
  readonly preview = computed<ServicePackage | null>(() => {
    const s = this.service(); if (!s) return null; const v = this.formValue(); const lines = (t: string) => t.split('\n').map(x => x.trim()).filter(Boolean);
    return { id: v.id || 'preview', serviceId: s.id, photographerId: s.photographerId, name: v.name || 'Package name', tier: v.tier, price: s.pricingModel === 'quote' ? null : v.price != null ? Number(v.price) : null, currency: 'MAD', description: v.description || 'Describe what makes this package special.', durationMinutes: Number(v.durationMinutes), editedPhotos: Number(v.editedPhotos), locations: Number(v.locations) || 1, outfitChanges: Number(v.outfitChanges), deliveryDays: Number(v.deliveryDays), includes: lines(v.includes), extras: lines(v.extras), travelConditions: v.travelConditions, bookingConditions: v.bookingConditions, featured: v.featured, status: 'draft' };
  });
  pick(id: string) { this.serviceId.set(id); void this.router.navigate([], { queryParams: { service: id }, replaceUrl: true }); }
  taken(t: PackageTier) { const k = this.byTier()[t]; return !!k && k.id !== this.form.controls.id.value; }
  create(t: PackageTier) { this.form.reset({ tier: t, name: t[0].toUpperCase() + t.slice(1), durationMinutes: 60, editedPhotos: 10, locations: 1, outfitChanges: 0, deliveryDays: 14, featured: false }); this.formValue.set(this.form.getRawValue()); this.error.set(''); this.editing.set(true); }
  edit(k: ServicePackage) { this.form.reset({ id: k.id, name: k.name, tier: k.tier, price: k.price, durationMinutes: k.durationMinutes, editedPhotos: k.editedPhotos, locations: k.locations, outfitChanges: k.outfitChanges, deliveryDays: k.deliveryDays, description: k.description, includes: k.includes.join('\n'), extras: k.extras.join('\n'), travelConditions: k.travelConditions, bookingConditions: k.bookingConditions, featured: k.featured }); this.formValue.set(this.form.getRawValue()); this.error.set(''); this.editing.set(true); }
  close() { this.editing.set(false); }
  save(status: 'draft' | 'published' = 'published') {
    const s = this.service(); if (!s) return; const quote = s.pricingModel === 'quote';
    touchAll(this.form); const v = this.form.getRawValue();
    if (this.form.invalid) { this.error.set('Please fix the highlighted fields.'); return; }
    if (!quote && !(v.price != null && Number(v.price) >= 0 && String(v.price) !== '')) { this.error.set('Enter a price.'); return; }
    if (this.taken(v.tier)) { this.error.set('You already have a package for that tier.'); return; }
    const lines = (t: string) => t.split('\n').map(x => x.trim()).filter(Boolean); this.busy.set(true); this.error.set('');
    this.ws.savePackage({ id: v.id || undefined, serviceId: s.id, name: v.name.trim(), tier: v.tier, price: quote ? null : Number(v.price), currency: 'MAD', description: v.description.trim(), durationMinutes: Number(v.durationMinutes), editedPhotos: Number(v.editedPhotos), locations: Number(v.locations), outfitChanges: Number(v.outfitChanges), deliveryDays: Number(v.deliveryDays), includes: lines(v.includes), extras: lines(v.extras), travelConditions: v.travelConditions, bookingConditions: v.bookingConditions, featured: v.featured, status })
      .subscribe({ next: () => { this.busy.set(false); this.editing.set(false); this.toast.success('Package saved.'); this.res.reload(); }, error: e => { this.busy.set(false); this.error.set(errorText(e)); } });
  }
  toggle(k: ServicePackage) { this.ws.setPackageStatus(k.id, k.status === 'published' ? 'draft' : 'published').subscribe({ next: () => { this.toast.success('Package updated.'); this.res.reload(); }, error: e => this.toast.error(errorText(e)) }); }
  async remove(k: ServicePackage) { const r = await this.confirm.ask({ title: `Delete “${k.name}”?`, message: 'Existing bookings keep their details. This cannot be undone.', confirmText: 'Delete', danger: true }); if (!r.ok) return; this.ws.deletePackage(k.id).subscribe({ next: () => { this.toast.success('Package deleted.'); this.res.reload(); }, error: e => this.toast.error(errorText(e)) }); }
}
