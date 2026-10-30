import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { of, switchMap } from 'rxjs';
import { CatalogRepository, PhotographerWorkspaceRepository, UploadRepository } from '../../core/api/repositories';
import { PricingModel, Service } from '../../core/models';
import { errorText, touchAll } from '../../core/util/forms';
import { PRICING_MODEL_LABEL, formatMoney } from '../../core/util/price';
import { SeoService } from '../../core/seo.service';
import { FieldComponent } from '../../shared/ui/field.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { ErrorStateComponent, PageHeaderComponent } from '../../shared/ui/misc';
import { ToastService } from '../../shared/services/overlay.services';

const STEPS = ['Details', 'Pricing', 'Deliverables & add-ons', 'Review'];
const COVERS = ['wedding', 'wedding-wide', 'wedding-bouquet', 'party', 'party-group', 'party-sunset', 'party-pool', 'birthday', 'birthday-candles', 'cupcakes', 'editing'].map(n => `img/${n}.jpg`);
const MODEL_HELP: Record<PricingModel, string> = {
  fixed: 'One price for the whole session. Packages carry the exact price.',
  hourly: 'Customers pick hours; the total is hourly rate × hours (server recalculates).',
  starting: 'A “from” price. The final price is confirmed with you after the request.',
  quote: 'No public price. Customers send a request and you reply with a quotation.',
};

@Component({
  selector: 'app-service-wizard',
  imports: [ReactiveFormsModule, RouterLink, FieldComponent, IconComponent, ErrorStateComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <app-page-header [title]="id ? 'Edit service' : 'New service'" subtitle="Describe it, price it, say what is delivered."><a class="btn btn--ghost" routerLink="/studio/services">Cancel</a></app-page-header>
  @if (res.error()) { <app-error-state [error]="res.error()" (retry)="res.reload()" /> }
  @else if (id && !res.value()) { <div class="skeleton" style="height: 360px"></div> }
  @else {
  <ol class="steps" aria-label="Progress">@for (s of steps; track s; let i = $index) { <li [class.on]="i === step()" [class.done]="i < step()"><button type="button" (click)="goto(i)"><span>{{ i < step() ? '✓' : i + 1 }}</span>{{ s }}</button></li> }</ol>
  <form [formGroup]="form" (ngSubmit)="$event.preventDefault()" novalidate class="stack">
    @switch (step()) {
      @case (0) { <section class="card card--pad stack">
        <app-field label="Title" [control]="form.controls.title" [required]="true"><input class="input" formControlName="title" maxlength="80" placeholder="Wedding day coverage" /></app-field>
        <app-field label="Category" [control]="form.controls.categoryId" [required]="true"><select class="select" formControlName="categoryId">@for (c of categories(); track c.id) { <option [value]="c.id">{{ c.name }}</option> }</select></app-field>
        <app-field label="Description" [control]="form.controls.description" [required]="true" hint="At least 40 characters"><textarea class="textarea" rows="5" formControlName="description"></textarea></app-field>
        <fieldset><legend class="field__label">Cover image</legend><div class="covers">@for (c of covers; track c) { <button type="button" [attr.aria-pressed]="form.controls.coverImage.value === c" (click)="form.controls.coverImage.setValue(c)"><img [src]="c" alt="" loading="lazy" /></button> }</div>
          <label class="btn btn--sm btn--outline up"><app-icon name="upload" [size]="15" />{{ uploading() ? 'Uploading…' : 'Upload your own' }}<input type="file" accept="image/jpeg,image/png,image/webp" hidden (change)="upload($event)" /></label>
          <p class="muted xs">JPEG, PNG or WebP up to 8 MB.</p></fieldset></section> }
      @case (1) { <section class="card card--pad stack">
        <fieldset class="stack"><legend class="field__label">How do you charge?</legend>
          <div class="models">@for (m of models; track m) { <label class="opt" [class.on]="form.controls.pricingModel.value === m"><input type="radio" formControlName="pricingModel" [value]="m" /><strong>{{ label(m) }}</strong><span class="muted small">{{ help[m] }}</span></label> }</div></fieldset>
        @if (form.controls.pricingModel.value !== 'quote') {
          <app-field [label]="form.controls.pricingModel.value === 'hourly' ? 'Hourly rate (MAD)' : form.controls.pricingModel.value === 'starting' ? 'Starting price (MAD)' : 'Price (MAD)'" [control]="form.controls.basePrice" [required]="true"><input class="input" type="number" min="1" formControlName="basePrice" /></app-field> }
        <app-field label="Session length (minutes)" [control]="form.controls.durationMinutes" hint="Used to find free slots in your calendar"><input class="input" type="number" min="15" step="15" formControlName="durationMinutes" /></app-field>
        <app-field label="Travel rules" hint="e.g. free within 20 km, 3 MAD/km after"><textarea class="textarea" rows="2" formControlName="travelRules"></textarea></app-field>
        <p class="muted small">Packages can refine the price per tier. Customers always see the final total calculated by the server before they send a request.</p></section> }
      @case (2) { <section class="card card--pad stack">
        <div class="form-grid"><app-field label="Edited photos delivered"><input class="input" type="number" min="0" formControlName="editedPhotos" /></app-field><app-field label="Delivery time (days)"><input class="input" type="number" min="1" formControlName="deliveryDays" /></app-field></div>
        <app-field label="Deliverables" hint="One per line"><textarea class="textarea" rows="4" formControlName="deliverables" placeholder="Online gallery&#10;Print-ready files"></textarea></app-field>
        <fieldset class="stack"><legend class="field__label">Add-ons</legend>
          @for (a of addOns.controls; track a; let i = $index) { <div class="ao" [formGroup]="a"><input class="input" formControlName="name" placeholder="Extra hour" [attr.aria-label]="'Add-on ' + (i + 1) + ' name'" /><input class="input num" type="number" min="0" formControlName="price" aria-label="Price in MAD" /><button type="button" class="btn btn--icon btn--ghost" (click)="addOns.removeAt(i)" aria-label="Remove add-on"><app-icon name="trash" [size]="16" /></button></div> }
          <button type="button" class="btn btn--sm btn--outline" (click)="addAddOn()"><app-icon name="plus" [size]="14" />Add an add-on</button></fieldset></section> }
      @case (3) { <section class="card card--pad stack"><h2>Review</h2>
        <dl class="rv"><dt>Title</dt><dd>{{ form.value.title }}</dd><dt>Pricing</dt><dd>{{ label(form.controls.pricingModel.value) }}@if (form.controls.pricingModel.value !== 'quote') { · {{ money(form.controls.basePrice.value) }} }</dd><dt>Duration</dt><dd>{{ form.controls.durationMinutes.value }} min</dd><dt>Deliverables</dt><dd>{{ form.controls.editedPhotos.value }} edited photos in {{ form.controls.deliveryDays.value }} days</dd><dt>Add-ons</dt><dd>{{ addOns.length }}</dd></dl>
        <p class="muted small">Your service appears on your public profile as soon as you save it. Add at least one package so customers can book it.</p></section> }
    }
    @if (error()) { <div class="notice notice--error" role="alert">{{ error() }}</div> }
    <div class="row"><button type="button" class="btn btn--ghost" [disabled]="step() === 0" (click)="goto(step() - 1)">Back</button><span class="grow"></span>
      @if (step() < 3) { <button type="button" class="btn btn--primary" (click)="next()">Continue</button> }
      @else { <button type="button" class="btn btn--primary" [disabled]="busy()" (click)="save('published')">Save service</button> }</div>
  </form>}`,
  styles: `.steps { display: flex; gap: 6px; margin-bottom: 20px; overflow-x: auto; } .steps li { flex: 1; min-width: 120px; } .steps button { width: 100%; display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--c-border); background: var(--c-surface); cursor: pointer; font-weight: 600; font-size: 13px; color: var(--c-text-muted); } .steps span { width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; background: var(--c-surface-2); font-size: 12px; } .on button { border-color: var(--c-primary-600); color: var(--c-ink); } .on span { background: var(--c-primary-600); color: #fff; } .done span { background: var(--c-success-solid); color: #fff; }
  fieldset { border: 0; padding: 0; margin: 0; } .covers { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; margin: 8px 0 12px; } .covers button { padding: 0; border: 2px solid transparent; border-radius: 10px; overflow: hidden; cursor: pointer; aspect-ratio: 4/3; background: none; } .covers button[aria-pressed='true'] { border-color: var(--c-primary-600); box-shadow: var(--shadow-1); } .covers img { width: 100%; height: 100%; object-fit: cover; display: block; } .up { cursor: pointer; }
  .models { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; } .opt { display: flex; flex-direction: column; gap: 4px; padding: 14px; border: 1px solid var(--c-border-strong); border-radius: 12px; cursor: pointer; } .opt input { position: absolute; opacity: 0; } .opt.on { border-color: var(--c-primary-600); background: var(--c-primary-50); } .opt:has(:focus-visible) { outline: 2px solid var(--c-primary-600); outline-offset: 2px; }
  .ao { display: grid; grid-template-columns: 1fr 120px auto; gap: 8px; align-items: center; } h2 { font-size: 1.25rem; } .rv { display: grid; grid-template-columns: 140px 1fr; gap: 8px 16px; } .rv dt { color: var(--c-text-muted); }`,
})
export class ServiceWizardPage {
  private fb = inject(FormBuilder); private ws = inject(PhotographerWorkspaceRepository); private catalog = inject(CatalogRepository); private upl = inject(UploadRepository);
  private toast = inject(ToastService); private router = inject(Router);
  readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');
  readonly steps = STEPS; readonly covers = COVERS; readonly help = MODEL_HELP; readonly models: PricingModel[] = ['fixed', 'hourly', 'starting', 'quote'];
  readonly step = signal(0); readonly busy = signal(false); readonly error = signal(''); readonly uploading = signal(false);
  readonly res = rxResource({
    stream: () => this.ws.myProfile().pipe(switchMap(p => this.catalog.services(p.id, { includeUnpublished: true }))),
  });
  readonly cats = rxResource({ stream: () => this.catalog.categories() }); readonly categories = computed(() => this.cats.value() ?? []);
  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(3)]], categoryId: ['portrait', Validators.required], description: ['', [Validators.required, Validators.minLength(40)]], coverImage: [COVERS[0]],
    pricingModel: ['fixed' as PricingModel], basePrice: [null as number | null], durationMinutes: [120, [Validators.required, Validators.min(15)]], travelRules: [''],
    editedPhotos: [30, Validators.min(0)], deliveryDays: [14, Validators.min(1)], deliverables: [''], addOns: this.fb.array<ReturnType<ServiceWizardPage['newAddOn']>>([]),
  });
  get addOns() { return this.form.controls.addOns; }
  private newAddOn(id = '', name = '', price = 0) { return this.fb.nonNullable.group({ id: [id], name: [name, Validators.required], price: [price, [Validators.required, Validators.min(0)]] }); }
  readonly label = (m: PricingModel) => PRICING_MODEL_LABEL[m]; readonly money = (n: number | null) => formatMoney(n, 'MAD');
  private loaded = false; private current?: Service;
  constructor() {
    inject(SeoService).set('Service');
    effect(() => {
      const list = this.res.value(); if (!list || this.loaded || !this.id) return; this.loaded = true;
      const s = list.find(x => x.id === this.id); if (!s) { this.error.set('Service not found.'); return; } this.current = s;
      this.form.patchValue({ title: s.title, categoryId: s.categoryId, description: s.description, coverImage: s.coverImage, pricingModel: s.pricingModel, basePrice: s.basePrice, durationMinutes: s.durationMinutes, travelRules: s.travelRules, editedPhotos: s.editedPhotos, deliveryDays: s.deliveryDays, deliverables: s.deliverables.join('\n') });
      for (const a of s.addOns) this.addOns.push(this.newAddOn(a.id, a.name, a.price));
    });
  }
  addAddOn() { this.addOns.push(this.newAddOn('')); }
  private stepValid(i: number) {
    const f = this.form.controls; touchAll(this.form);
    if (i === 0) return f.title.valid && f.categoryId.valid && f.description.valid;
    if (i === 1) { if (f.pricingModel.value !== 'quote' && !(f.basePrice.value && f.basePrice.value > 0)) { f.basePrice.setErrors({ required: true }); return false; } return f.durationMinutes.valid; }
    if (i === 2) return this.addOns.valid && f.editedPhotos.valid && f.deliveryDays.valid;
    return true;
  }
  next() { if (!this.stepValid(this.step())) { this.error.set('Please fix the highlighted fields.'); return; } this.error.set(''); this.step.update(s => s + 1); }
  goto(i: number) { if (i <= this.step()) { this.step.set(Math.max(0, i)); return; } for (let k = this.step(); k < i; k++) if (!this.stepValid(k)) { this.error.set('Complete the previous steps first.'); return; } this.step.set(i); }
  upload(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0]; if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 8 * 1024 * 1024) { this.toast.error('Use a JPEG, PNG or WebP image up to 8 MB.'); return; }
    this.uploading.set(true); this.upl.upload(file).subscribe({ next: r => { this.uploading.set(false); this.form.controls.coverImage.setValue(r.url); }, error: e => { this.uploading.set(false); this.toast.error(errorText(e)); } });
  }
  save(status: Service['status']) {
    for (let i = 0; i < 3; i++) if (!this.stepValid(i)) { this.step.set(i); this.error.set('Please fix the highlighted fields.'); return; }
    const v = this.form.getRawValue(); this.busy.set(true); this.error.set('');
    this.ws.saveService({
      id: this.id ?? undefined, title: v.title.trim(), categoryId: v.categoryId, description: v.description.trim(), coverImage: v.coverImage, pricingModel: v.pricingModel,
      basePrice: v.pricingModel === 'quote' ? null : Number(v.basePrice), durationMinutes: Number(v.durationMinutes), travelRules: v.travelRules, editedPhotos: Number(v.editedPhotos), deliveryDays: Number(v.deliveryDays),
      deliverables: v.deliverables.split('\n').map(x => x.trim()).filter(Boolean), addOns: v.addOns.map((a, i) => ({ id: a.id || `ao-${Date.now()}-${i}`, name: a.name, price: Number(a.price) })), status,
    }).subscribe({ next: s => { this.busy.set(false); this.toast.success('Service saved.'); void this.router.navigate(this.id ? ['/studio/services'] : ['/studio/packages'], { queryParams: this.id ? {} : { service: s.id } }); }, error: e => { this.busy.set(false); this.error.set(errorText(e)); } });
  }
}
