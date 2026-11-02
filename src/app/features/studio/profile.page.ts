import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { CatalogRepository, PhotographerWorkspaceRepository } from '../../core/api/repositories';
import { SessionStore } from '../../core/auth/session.store';
import { isPlaceholder } from '../../core/http/http-util';
import { GearItem, GeoPoint, PhotographerProfile, WorkMode } from '../../core/models';
import { GeoResult, GeocodingService } from '../../core/geo/geocoding.service';
import { CITIES, CITY_COORDS } from '../../core/geo/gazetteer';
import { cleanGear } from '../../core/util/gear';
import { MIN_PORTFOLIO_PHOTOS } from '../../core/util/profile-rules';
import { errorText, touchAll } from '../../core/util/forms';
import { SeoService } from '../../core/seo.service';
import { FieldComponent } from '../../shared/ui/field.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { ErrorStateComponent, PageHeaderComponent } from '../../shared/ui/misc';
import { AvatarEditorComponent } from '../../shared/ui/avatar-editor.component';
import { GearEditorComponent } from './gear-editor.component';
import { LocationPickerComponent } from '../../shared/map/location-picker.component';
import { LocationSearchComponent } from '../../shared/map/location-search.component';
import { ConfirmService, ToastService } from '../../shared/services/overlay.services';

const STEPS = ['Basics', 'Location', 'Specialties & gear', 'Policies', 'Review'];

/** Profile editor. Route data `onboarding: true` turns it into an optional guided setup. There is no review step: a photographer is live from sign-up. */
@Component({
  selector: 'app-studio-profile',
  imports: [ReactiveFormsModule, RouterLink, FieldComponent, IconComponent, ErrorStateComponent, PageHeaderComponent, LocationPickerComponent, LocationSearchComponent, GearEditorComponent, AvatarEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <app-page-header [title]="onboarding ? 'Set up your studio' : 'Profile & location'" [subtitle]="onboarding ? 'Five short steps. Your profile is already live — fill in more whenever you like.' : 'What customers see on your public profile and on the map.'">
    @if (!onboarding) { <a class="btn btn--outline" [routerLink]="['/photographers', res.value()?.profile?.id ?? '']"><app-icon name="external-link" [size]="16" />View public profile</a> }
  </app-page-header>
  @if (res.error()) { <app-error-state [error]="res.error()" (retry)="res.reload()" /> }
  @else if (!res.value()) { <div class="skeleton" style="height: 420px"></div> }
  @else {
    @if (onboarding) { <ol class="steps" aria-label="Setup progress">@for (s of steps; track s; let i = $index) { <li [class.on]="i === step()" [class.done]="i < step()"><button type="button" (click)="go(i)"><span>{{ i < step() ? '✓' : i + 1 }}</span>{{ s }}</button></li> }</ol> }
    @let p = res.value()!.profile;
    <form [formGroup]="form" class="stack" (ngSubmit)="save()" novalidate>
      @if (show(0)) {
        <section class="card card--pad stack"><h2>Basics</h2>
          <app-avatar-editor [src]="p.avatarUrl" [name]="form.controls.displayName.value" (changed)="setAvatar($event)" />
          <div class="form-grid">
            <app-field label="Display name" [control]="form.controls.displayName" [required]="true"><input class="input" formControlName="displayName" /></app-field>
            <app-field label="Business name" hint="Optional"><input class="input" formControlName="businessName" /></app-field>
            <app-field label="Headline" [control]="form.controls.headline" [required]="true" hint="One line shown on cards (max 90 characters)" class="full"><input class="input" formControlName="headline" maxlength="90" /></app-field>
            <app-field label="Bio" [control]="form.controls.bio" [required]="true" hint="At least 100 characters. Say who you shoot for and your style." class="full"><textarea class="textarea" rows="5" formControlName="bio"></textarea></app-field>
            <app-field label="Years of experience" [control]="form.controls.yearsExperience"><input class="input" type="number" min="0" max="60" formControlName="yearsExperience" /></app-field>
            <app-field label="Phone" hint="Used by our team only; not shown publicly"><input class="input" type="tel" formControlName="phone" /></app-field>
            <app-field label="Languages" hint="Comma separated" class="full"><input class="input" formControlName="languages" placeholder="Arabic, French, English" /></app-field>
          </div></section>
      }
      @if (show(1)) {
        <section class="card card--pad stack"><h2>Where do you work?</h2>
          <div class="modes" role="radiogroup" aria-label="How you work">
            <button type="button" role="radio" class="mode" [attr.aria-checked]="mode() === 'freelancer'" (click)="setMode('freelancer')"><app-icon name="user" [size]="22" /><strong>I'm a freelancer</strong><span>No shop. I travel to my clients, so I only choose my city.</span></button>
            <button type="button" role="radio" class="mode" [attr.aria-checked]="mode() === 'shop'" (click)="setMode('shop')"><app-icon name="store" [size]="22" /><strong>I have a shop or studio</strong><span>Customers can visit me. I place my shop exactly on the map.</span></button>
          </div>
          <div class="form-grid">
            <app-field label="City" [control]="form.controls.city" [required]="true"><select class="select" formControlName="city">@for (c of cities; track c) { <option [value]="c">{{ c }}</option> }</select></app-field>
            @if (mode() === 'shop') { <app-field label="Neighbourhood" hint="Optional, shown publicly"><input class="input" formControlName="neighborhood" /></app-field> }
          </div>
          @if (mode() === 'freelancer') {
            <div class="notice notice--info"><app-icon name="shield" [size]="18" /><div>Customers see your <strong>city</strong> and an approximate spot inside it on the map. Your exact address is never published and is not collected.</div></div>
          } @else {
            <div class="notice notice--info"><app-icon name="map-pin" [size]="18" /><div>Your shop's <strong>exact position is public</strong> on the map so customers can find you. Search for it, drag the pin onto the entrance, or type its coordinates.</div></div>
            <app-field label="Shop address" hint="Optional. Filled in automatically from “My location” or a picked place; you can edit it."><input class="input" maxlength="160" [value]="shopAddress()" (input)="shopAddress.set($any($event.target).value)" /></app-field>
            <app-location-search label="Find your shop" placeholder="Search an address, street or neighbourhood" [locate]="true" (picked)="picked($event)" />
            <app-location-picker [point]="point()" [radiusKm]="form.controls.serviceRadiusKm.value || null" [height]="360" (pointChange)="movePin($event)" />
            <div class="form-grid">
              <app-field label="Latitude" hint="Between -90 and 90"><input class="input" type="number" step="any" min="-90" max="90" [value]="point().lat" (change)="setCoord('lat', $any($event.target).value)" /></app-field>
              <app-field label="Longitude" hint="Between -180 and 180"><input class="input" type="number" step="any" min="-180" max="180" [value]="point().lng" (change)="setCoord('lng', $any($event.target).value)" /></app-field>
            </div>
            @if (pinSet()) { <p class="pin pin--ok small" role="status"><app-icon name="check-circle" [size]="16" />Shop pinned at {{ point().lat }}, {{ point().lng }}</p> }
            @else { <p class="pin pin--no small" role="alert"><app-icon name="alert-triangle" [size]="16" />Place the pin on your shop before saving.</p> }
          }
          <app-field label="Travel distance" [hint]="(mode() === 'shop' ? 'Also travel to clients up to ' : 'Travel up to ') + form.controls.serviceRadiusKm.value + ' km (straight-line distance, not driving time)'"><input type="range" [attr.min]="mode() === 'shop' ? 0 : 2" max="150" step="1" formControlName="serviceRadiusKm" /></app-field>
        </section>
      }
      @if (show(2)) {
        <section class="card card--pad stack"><h2>Specialties</h2><p class="muted">Pick up to 5 categories. They drive discovery filters.</p>
          <div class="chips" role="group" aria-label="Specialties">@for (c of res.value()!.categories; track c.id) { <button type="button" class="chip" [attr.aria-pressed]="spec().includes(c.id)" (click)="toggleSpec(c.id)">{{ c.name }}</button> }</div>
          @if (!spec().length) { <p class="field__error" role="alert">Choose at least one specialty.</p> }
        </section>
        <section class="card card--pad stack"><h2>Your equipment</h2><p class="muted">What you shoot with: cameras, lenses, video, drones, lighting… All optional.</p>
          <app-gear-editor [(items)]="gear" />
          <label class="check"><input type="checkbox" [checked]="showGear()" (change)="showGear.set($any($event.target).checked)" /><span>Show my equipment on my public profile<br /><span class="muted small">Turn this off to keep it private. Your list is kept either way.</span></span></label>
        </section>
      }
      @if (show(3)) {
        <section class="card card--pad stack"><h2>Cancellation policy</h2>
          <div class="form-grid" formGroupName="policy">
            <app-field label="Free cancellation until (hours before)"><input class="input" type="number" min="0" max="720" formControlName="freeCancelHours" /></app-field>
            <app-field label="Then partial refund (%)"><input class="input" type="number" min="0" max="100" formControlName="partialRefundPercent" /></app-field>
            <app-field label="…until (hours before)"><input class="input" type="number" min="0" max="720" formControlName="partialRefundHours" /></app-field>
          </div>
          <p class="muted small">Refunds are recorded as bookkeeping in this prototype; actual money movement needs the payment backend.</p>
          <app-field label="Other policies" hint="One per line (e.g. late arrival, usage rights)"><textarea class="textarea" rows="4" formControlName="policies"></textarea></app-field>
        </section>
      }
      @if (show(4)) {
        <section class="card card--pad stack"><h2>Profile strength</h2>
          <ul class="chk">@for (c of checklist(); track c.label) { <li [class.ok]="c.ok"><app-icon [name]="c.ok ? 'check-circle' : 'x-circle'" [size]="18" /><span>{{ c.label }}</span>@if (c.link) { <a [routerLink]="c.link">{{ c.ok ? 'Edit' : 'Fix' }}</a> }</li> }</ul>
          <p class="muted small">Nothing here blocks you: your profile is visible to customers already. The more you complete, the more bookings you get.</p>
          <div class="row"><button type="button" class="btn btn--primary btn--lg" [disabled]="busy()" (click)="finish()">Go to my dashboard</button></div>
        </section>
      }
      @if (error()) { <div class="notice notice--error" role="alert">{{ error() }}</div> }
      <div class="row bar">
        @if (onboarding) { <button type="button" class="btn btn--ghost" [disabled]="step() === 0" (click)="go(step() - 1)">Back</button> }
        <span class="grow"></span>
        @if (!onboarding || step() < 4) { <button class="btn" [class.btn--primary]="true" type="submit" [disabled]="busy()">{{ busy() ? 'Saving…' : onboarding ? 'Save & continue' : 'Save changes' }}</button> }
      </div>
    </form>
  }`,
  styles: `.steps { display: flex; gap: 6px; margin-bottom: 20px; overflow-x: auto; padding-bottom: 4px; } .steps li { flex: 1; min-width: 110px; } .steps button { width: 100%; display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--c-border); background: var(--c-surface); cursor: pointer; font-weight: 600; font-size: 13px; color: var(--c-text-muted); } .steps span { width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; background: var(--c-surface-2); font-size: 12px; } .steps .on button { border-color: var(--c-primary-600); color: var(--c-ink); } .steps .on span { background: var(--c-primary-600); color: #fff; } .steps .done span { background: var(--c-success-solid); color: #fff; }
  h2 { font-size: 1.25rem; } .modes { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; } .mode { text-align: left; display: flex; flex-direction: column; gap: 6px; padding: 16px; border-radius: 14px; border: 2px solid var(--c-border); background: var(--c-surface); color: var(--c-text); cursor: pointer; } .mode span { font-size: 13px; color: var(--c-text-muted); } .mode app-icon { color: var(--c-primary-text); } .mode[aria-checked='true'] { border-color: var(--c-primary-600); background: var(--c-primary-50); } .pin { display: flex; align-items: center; gap: 8px; margin: 0; } .pin--ok { color: var(--c-success); } .pin--no { color: var(--c-error); } @media (max-width: 640px) { .modes { grid-template-columns: 1fr; } } .full { grid-column: 1 / -1; } .chips { display: flex; flex-wrap: wrap; gap: 8px; } .chk { display: flex; flex-direction: column; gap: 10px; } .chk li { display: flex; align-items: center; gap: 10px; color: var(--c-error); } .chk li.ok { color: var(--c-success); } .chk li span { flex: 1; color: var(--c-ink); } .bar { position: sticky; bottom: 0; background: linear-gradient(transparent, var(--c-bg) 30%); padding: 16px 0 4px; }`,
})
export class StudioProfilePage {
  private ws = inject(PhotographerWorkspaceRepository); private catalog = inject(CatalogRepository); private fb = inject(FormBuilder);
  private toast = inject(ToastService); private session = inject(SessionStore); private router = inject(Router); private confirm = inject(ConfirmService); private geo = inject(GeocodingService);
  readonly onboarding = !!inject(ActivatedRoute).snapshot.data['onboarding'];
  readonly steps = STEPS; readonly cities = CITIES; readonly step = signal(0); readonly busy = signal(false); readonly error = signal('');
  readonly point = signal<GeoPoint>({ lat: 31.63, lng: -8.0 }); readonly spec = signal<string[]>([]);
  readonly mode = signal<WorkMode>('freelancer'); readonly shopAddress = signal(''); readonly pinSet = signal(false);
  readonly gear = signal<GearItem[]>([]); readonly showGear = signal(true);
  readonly res = rxResource({
    stream: () => this.ws.myProfile().pipe(switchMap(profile => forkJoin({
      profile: of(profile), categories: this.catalog.categories(),
      hasPackage: this.catalog.packages(profile.id, { includeUnpublished: true }).pipe(map(k => k.length > 0)),
    }))),
  });
  readonly form = this.fb.nonNullable.group({
    displayName: ['', [Validators.required, Validators.minLength(2)]], businessName: [''], headline: ['', [Validators.required, Validators.maxLength(90)]], bio: ['', [Validators.required, Validators.minLength(100)]],
    yearsExperience: [0, [Validators.min(0), Validators.max(60)]], phone: [''], languages: [''], city: ['', Validators.required], neighborhood: [''], serviceRadiusKm: [25],
    policy: this.fb.nonNullable.group({ freeCancelHours: [48], partialRefundPercent: [50], partialRefundHours: [24] }), policies: [''],
  });
  constructor() {
    inject(SeoService).set(this.onboarding ? 'Studio setup' : 'Profile & location');
    effect(() => { const v = this.res.value(); if (v) this.load(v.profile); });
  }
  private loaded = false;
  private load(p: PhotographerProfile) {
    if (this.loaded) return; this.loaded = true;
    this.form.patchValue({ displayName: p.displayName, businessName: p.businessName ?? '', headline: p.headline, bio: p.bio, yearsExperience: p.yearsExperience, phone: p.phone ?? '', languages: p.languages.join(', '), city: p.city, neighborhood: p.neighborhood ?? '', serviceRadiusKm: p.serviceRadiusKm, policy: { freeCancelHours: p.cancellationPolicy.freeCancelHours, partialRefundPercent: p.cancellationPolicy.partialRefundPercent, partialRefundHours: p.cancellationPolicy.partialRefundHours }, policies: p.policies.join('\n') });
    this.mode.set(p.workMode); this.shopAddress.set(p.shopAddress ?? ''); this.pinSet.set(p.workMode === 'shop');
    this.gear.set(p.gear.map(g => ({ ...g }))); this.showGear.set(p.showGear);
    this.point.set(p.publicLocation); this.spec.set([...p.specialties]); this.step.set(this.onboarding ? Math.min(p.onboardingStep, 4) : 0);
  }
  show(i: number) { return !this.onboarding || this.step() === i; }
  go(i: number) { this.step.set(Math.max(0, Math.min(4, i))); this.error.set(''); }
  toggleSpec(id: string) { this.spec.update(s => s.includes(id) ? s.filter(x => x !== id) : s.length < 5 ? [...s, id] : s); }
  setMode(m: WorkMode) {
    if (m === this.mode()) return; this.mode.set(m); this.error.set('');
    const radius = this.form.controls.serviceRadiusKm; if (m === 'freelancer' && radius.value < 2) radius.setValue(2);
    if (m === 'shop' && !this.pinSet()) this.point.set(CITY_COORDS[this.form.controls.city.value] ?? this.point()); // start the pin in the chosen city; the shop still has to be placed on purpose
  }
  movePin(pt: GeoPoint) { this.point.set(pt); this.pinSet.set(true); }
  setCoord(axis: 'lat' | 'lng', raw: string) {
    const v = Number(raw); const max = axis === 'lat' ? 90 : 180;
    if (raw.trim() === '' || !Number.isFinite(v) || Math.abs(v) > max) { this.error.set(`${axis === 'lat' ? 'Latitude' : 'Longitude'} must be a number between -${max} and ${max}.`); this.point.update(p => ({ ...p })); return; }
    this.error.set(''); this.movePin({ ...this.point(), [axis]: +v.toFixed(6) });
  }
  picked(r: GeoResult) { this.movePin(r.point); if (r.address) this.shopAddress.set(r.address); if (r.city && this.cities.includes(r.city)) this.form.controls.city.setValue(r.city); }
  private list(s: string) { return s.split(/[,\n]/).map(x => x.trim()).filter(Boolean); }
  readonly checklist = computed(() => {
    const p = this.res.value()?.profile; if (!p) return [];
    const v = this.form.getRawValue(); const v2 = this.res.value()!;
    return [
      { label: 'Name, headline and a bio of 100+ characters', ok: !!v.displayName && !!v.headline && v.bio.length >= 100, link: '' },
      { label: this.mode() === 'shop' ? 'Shop placed exactly on the map' : 'City and travel distance set', ok: !!v.city && (this.mode() === 'freelancer' || this.pinSet()) && p.onboardingStep >= 2, link: '' },
      { label: 'At least one specialty', ok: this.spec().length > 0, link: '' },
      { label: `At least ${MIN_PORTFOLIO_PHOTOS} portfolio photos`, ok: p.portfolio.filter(i => i.visible).length >= MIN_PORTFOLIO_PHOTOS, link: '/studio/portfolio' },
      { label: 'A service with at least one package (optional — you can add it later)', ok: v2.hasPackage, link: '/studio/services' },
    ];
  });

  save(after?: () => void) {
    if (this.form.invalid) { touchAll(this.form); this.error.set('Please fix the highlighted fields.'); return; }
    if (this.onboarding && this.step() === 2 && !this.spec().length) { this.error.set('Choose at least one specialty.'); return; }
    if (this.mode() === 'shop' && !this.pinSet()) { this.error.set('Place your shop on the map (or type its coordinates) before saving.'); return; }
    this.error.set(''); this.busy.set(true); const v = this.form.getRawValue();
    const step = this.onboarding ? Math.max(this.res.value()!.profile.onboardingStep, this.step() + 1) : undefined;
    this.ws.updateProfile({ displayName: v.displayName, businessName: v.businessName || undefined, headline: v.headline, bio: v.bio, yearsExperience: +v.yearsExperience, phone: v.phone || undefined, languages: this.list(v.languages), gear: cleanGear(this.gear()), showGear: this.showGear(), neighborhood: this.mode() === 'shop' ? v.neighborhood || undefined : undefined, specialties: this.spec(), cancellationPolicy: { ...this.res.value()!.profile.cancellationPolicy, ...v.policy }, policies: this.list(v.policies), ...(step !== undefined ? { onboardingStep: step } : {}) }).subscribe({
      next: () => this.ws.setLocation(this.mode() === 'shop' ? { workMode: 'shop', city: v.city, radiusKm: +v.serviceRadiusKm, point: this.point(), shopAddress: this.shopAddress() || undefined } : { workMode: 'freelancer', city: v.city, radiusKm: +v.serviceRadiusKm }).subscribe({
        next: () => { this.busy.set(false); this.toast.success('Saved.'); this.loaded = false; this.res.reload(); if (after) after(); else if (this.onboarding && this.step() < 4) this.step.update(s => s + 1); },
        error: e => { this.busy.set(false); this.error.set(errorText(e)); },
      }),
      error: e => { this.busy.set(false); this.error.set(errorText(e)); },
    });
  }
  setAvatar(url: string) {
    this.ws.updateProfile({ avatarUrl: url }).subscribe({ next: p => { this.session.patchUser({ avatarUrl: isPlaceholder(p.avatarUrl) ? '' : p.avatarUrl }); this.toast.success(url ? 'Profile picture updated.' : 'Back to the default picture.'); }, error: e => this.toast.error(errorText(e)) });
  }
  finish() { this.toast.success('You are all set — your profile is live.'); void this.router.navigateByUrl('/studio'); }
}