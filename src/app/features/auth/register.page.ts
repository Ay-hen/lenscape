import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { CITIES } from '../../core/geo/gazetteer';
import { applyServerErrors, passwordsMatch } from '../../core/util/forms';
import { SeoService } from '../../core/seo.service';
import { FieldComponent } from '../../shared/ui/field.component';

/** One page, two audiences: customers sign up directly; photographers continue into the onboarding wizard. */
@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, FieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="wrap"><div class="box card card--pad"><p class="eyebrow">{{ photographer() ? 'For photographers' : 'Create account' }}</p>
    <h1>{{ photographer() ? 'Grow your photography business' : 'Join Lenscape' }}</h1>
    <p class="muted">We will email you a 6-digit code to confirm your address. {{ photographer() ? 'Create your account and you are live straight away — add your portfolio, packages and availability whenever you are ready.' : 'Save favourite photographers, track bookings and message photographers.' }}</p>
    <form [formGroup]="form" (ngSubmit)="submit()" class="form-grid" novalidate>
      <app-field label="Full name" [control]="form.controls.name" [required]="true"><input class="input" formControlName="name" autocomplete="name" /></app-field>
      <app-field label="Username" [control]="form.controls.username" [required]="true" hint="Letters, numbers and dots"><input class="input" formControlName="username" autocomplete="username" /></app-field>
      <app-field label="Email" [control]="form.controls.email" [required]="true"><input class="input" type="email" formControlName="email" autocomplete="email" /></app-field>
      @if (photographer()) {
        <app-field label="Phone" [control]="form.controls.phone" [required]="true"><input class="input" type="tel" formControlName="phone" autocomplete="tel" placeholder="+212 6…" /></app-field>
        <app-field label="Main city" [control]="form.controls.city" [required]="true"><select class="select" formControlName="city">@for (c of cities; track c) { <option [value]="c">{{ c }}</option> }</select></app-field>
      }
      <app-field label="Password" [control]="form.controls.password" [required]="true" hint="At least 8 characters"><input class="input" type="password" formControlName="password" autocomplete="new-password" /></app-field>
      <app-field label="Confirm password" [control]="form" [required]="true"><input class="input" type="password" formControlName="confirm" autocomplete="new-password" /></app-field>
      <label class="check full"><input type="checkbox" formControlName="terms" /><span>I agree to the terms and privacy policy (placeholder text in this prototype).</span></label>
      @if (error()) { <div class="notice notice--error full" role="alert">{{ error() }}</div> }
      <button class="btn btn--primary btn--lg full" type="submit" [disabled]="loading()">{{ loading() ? 'Sending code…' : 'Continue' }}</button>
    </form>
    <p class="small muted center">Already have an account? <a routerLink="/login">Sign in</a> · @if (photographer()) { <a routerLink="/register">I'm a customer</a> } @else { <a routerLink="/register/photographer">I'm a photographer</a> }</p></div></div>`,
  styles: `.wrap { display: grid; place-items: center; padding: 40px 16px; } .box { width: min(100%, 640px); display: flex; flex-direction: column; gap: 14px; padding: 32px; } h1 { font-size: 2rem; } .full { grid-column: 1 / -1; } .center { text-align: center; }`,
})
export class RegisterPage {
  readonly mode = input<'customer' | 'photographer'>('customer');
  readonly photographer = computed(() => this.mode() === 'photographer');
  private fb = inject(FormBuilder); private auth = inject(AuthService); private router = inject(Router);
  readonly cities = CITIES; readonly loading = signal(false); readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]], username: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._]{3,30}$/)]], email: ['', [Validators.required, Validators.email]],
    phone: [''], city: ['Casablanca'], password: ['', [Validators.required, Validators.minLength(8)]], confirm: ['', Validators.required], terms: [false, Validators.requiredTrue],
  }, { validators: passwordsMatch('password', 'confirm') });
  constructor() { inject(SeoService).set('Create account'); }
  submit() {
    if (this.photographer()) this.form.controls.phone.addValidators(Validators.required); else this.form.controls.phone.clearValidators();
    this.form.controls.phone.updateValueAndValidity();
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true); this.error.set('');
    const v = this.form.getRawValue();
    const req$ = this.photographer() ? this.auth.registerPhotographer({ name: v.name, username: v.username, email: v.email, password: v.password, phone: v.phone, city: v.city }) : this.auth.registerCustomer({ name: v.name, username: v.username, email: v.email, password: v.password });
    req$.subscribe({
      next: r => void this.router.navigate(['/verify-email'], { queryParams: { email: r.email, expires: r.otpExpiresInSeconds } }),
      error: e => { this.loading.set(false); this.error.set(applyServerErrors(this.form, e)); },
    });
  }
}
