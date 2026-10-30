import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthRepository, CustomerRepository } from '../../core/api/repositories';
import { SessionStore } from '../../core/auth/session.store';
import { SavedLocation } from '../../core/models';
import { CITIES } from '../../core/geo/gazetteer';
import { GeoResult } from '../../core/geo/geocoding.service';
import { applyServerErrors, errorText, passwordsMatch } from '../../core/util/forms';
import { FieldComponent } from '../../shared/ui/field.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { ErrorStateComponent, PageHeaderComponent } from '../../shared/ui/misc';
import { AvatarEditorComponent } from '../../shared/ui/avatar-editor.component';
import { LocationSearchComponent } from '../../shared/map/location-search.component';
import { ToastService } from '../../shared/services/overlay.services';
import { SeoService } from '../../core/seo.service';

@Component({
  selector: 'app-account-settings',
  imports: [ReactiveFormsModule, FieldComponent, IconComponent, ErrorStateComponent, PageHeaderComponent, LocationSearchComponent, AvatarEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-page-header title="Profile & settings" subtitle="Manage your details, saved places and security." />
  @if (res.error()) { <app-error-state [error]="res.error()" (retry)="res.reload()" /> } @else {
  <div class="stack stack--lg" style="max-width: 760px">
    <section class="card card--pad"><app-avatar-editor [src]="res.value()?.avatarUrl ?? ''" [name]="form.controls.name.value" (changed)="setAvatar($event)" /></section>
    <form class="card card--pad stack" [formGroup]="form" (ngSubmit)="save()" novalidate><h3>Personal details</h3>
      <div class="form-grid"><app-field label="Full name" [control]="form.controls.name" [required]="true"><input class="input" formControlName="name" /></app-field>
        <app-field label="Email" [control]="form.controls.email" [required]="true" hint="Verified address — it cannot be changed here"><input class="input" type="email" formControlName="email" readonly aria-readonly="true" /></app-field>
        <app-field label="Phone" [control]="form.controls.phone"><input class="input" type="tel" formControlName="phone" /></app-field>
        <app-field label="City" [control]="form.controls.city"><select class="select" formControlName="city"><option value="">—</option>@for (c of cities; track c) { <option [value]="c">{{ c }}</option> }</select></app-field></div>
      <h3>Notifications</h3><div class="stack stack--sm"><label class="check"><input type="checkbox" formControlName="email_n" /><span>Email me about booking updates and messages</span></label><label class="check"><input type="checkbox" formControlName="push" /><span>In-app notifications</span></label><label class="check"><input type="checkbox" formControlName="marketing" /><span>Occasional offers and promotions</span></label></div>
      <p class="xs muted">Email delivery is sent by the backend once connected; these preferences are stored on your profile.</p>
      <div><button class="btn btn--primary" type="submit" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save changes' }}</button></div></form>

    <section class="card card--pad stack"><h3>Saved locations</h3>
      @for (l of locations(); track l.id) { <div class="loc"><app-icon name="map-pin" [size]="16" /><div class="grow"><strong>{{ l.label }}</strong><div class="small muted">{{ l.address }}</div></div><button class="btn btn--sm btn--danger-ghost" type="button" (click)="removeLoc(l.id)">Remove</button></div> } @empty { <p class="muted small">No saved places yet — add your home or a favourite venue to speed up booking.</p> }
      <app-location-search placeholder="Add a place" label="Add a saved place" [locate]="false" (picked)="addLoc($event)" /></section>

    <form class="card card--pad stack" [formGroup]="pw" (ngSubmit)="changePassword()" novalidate><h3>Password</h3>
      <div class="form-grid"><app-field label="Current password" [control]="pw.controls.current" [required]="true"><input class="input" type="password" formControlName="current" autocomplete="current-password" /></app-field><span></span>
        <app-field label="New password" [control]="pw.controls.next" [required]="true" hint="At least 8 characters"><input class="input" type="password" formControlName="next" autocomplete="new-password" /></app-field>
        <app-field label="Confirm new password" [control]="pw" [required]="true"><input class="input" type="password" formControlName="confirm" autocomplete="new-password" /></app-field></div>
      <div><button class="btn btn--outline" type="submit">Update password</button></div></form>
  </div> }`,
  styles: `h3 { font-size: 1.15rem; } .loc { display: flex; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--c-border); }`,
})
export class AccountSettingsPage {
  private repo = inject(CustomerRepository); private auth = inject(AuthRepository); private fb = inject(FormBuilder); private toast = inject(ToastService); private session = inject(SessionStore);
  readonly cities = CITIES; readonly saving = signal(false); readonly locations = signal<SavedLocation[]>([]);
  readonly res = rxResource({ params: () => 1, stream: () => this.repo.getProfile() });
  readonly form = this.fb.nonNullable.group({ name: ['', [Validators.required, Validators.minLength(3)]], email: ['', [Validators.required, Validators.email]], phone: [''], city: [''], email_n: [true], push: [true], marketing: [false] });
  readonly pw = this.fb.nonNullable.group({ current: ['', Validators.required], next: ['', [Validators.required, Validators.minLength(8)]], confirm: ['', Validators.required] }, { validators: passwordsMatch('next', 'confirm') });
  constructor() {
    inject(SeoService).set('Settings');
    effect(() => { const p = this.res.value(); if (p) { this.form.patchValue({ name: p.name, email: p.email, phone: p.phone ?? '', city: p.city ?? '', email_n: p.notificationPrefs.email, push: p.notificationPrefs.push, marketing: p.notificationPrefs.marketing }); this.locations.set(p.savedLocations); } });
  }
  private persist(msg: string) {
    const v = this.form.getRawValue(); this.saving.set(true);
    this.repo.updateProfile({ name: v.name, phone: v.phone, city: v.city, savedLocations: this.locations(), notificationPrefs: { email: v.email_n, push: v.push, sms: false, marketing: v.marketing } }).subscribe({ next: p => { this.saving.set(false); this.session.patchUser({ name: p.name, email: p.email, city: p.city }); this.toast.success(msg); }, error: e => { this.saving.set(false); this.toast.error(applyServerErrors(this.form, e)); } });
  }
  setAvatar(url: string) {
    this.repo.updateProfile({ avatarUrl: url }).subscribe({ next: p => { this.session.patchUser({ avatarUrl: p.avatarUrl ?? '' }); this.toast.success(url ? 'Profile picture updated.' : 'Back to the default picture.'); }, error: e => this.toast.error(errorText(e)) });
  }
  save() { if (this.form.invalid) { this.form.markAllAsTouched(); return; } this.persist('Profile saved.'); }
  addLoc(r: GeoResult) { this.locations.update(l => [...l, { id: 'loc' + Date.now(), label: r.label.split(',')[0], address: r.label, point: r.point }]); this.persist('Place saved.'); }
  removeLoc(id: string) { this.locations.update(l => l.filter(x => x.id !== id)); this.persist('Place removed.'); }
  changePassword() { if (this.pw.invalid) { this.pw.markAllAsTouched(); return; } const v = this.pw.getRawValue(); this.auth.changePassword(v.current, v.next).subscribe({ next: () => { this.toast.success('Password updated.'); this.pw.reset(); }, error: e => { applyServerErrors(this.pw, e); this.toast.error(errorText(e)); } }); }
}
