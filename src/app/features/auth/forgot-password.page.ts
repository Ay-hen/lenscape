import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { applyServerErrors } from '../../core/util/forms';
import { FieldComponent } from '../../shared/ui/field.component';

/** Password recovery, step 1: the person enters the e-mail of the account; a 6-digit code is sent if an account uses it. */
@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink, FieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="wrap"><div class="box card card--pad"><p class="eyebrow">Password recovery</p>
    <h1>Forgot your password?</h1>
    <p class="muted">Enter the email of your account. We will send you a 6-digit code to choose a new password.</p>
    <form [formGroup]="form" (ngSubmit)="submit()" class="stack" novalidate>
      <app-field label="Email" [control]="form.controls.email" [required]="true"><input class="input" type="email" formControlName="email" autocomplete="email" inputmode="email" /></app-field>
      @if (error()) { <div class="notice notice--error" role="alert">{{ error() }}</div> }
      <button class="btn btn--primary btn--lg" type="submit" [disabled]="loading()">{{ loading() ? 'Sending…' : 'Send me a code' }}</button>
    </form>
    <p class="small muted center"><a routerLink="/login">Back to sign in</a></p>
  </div></div>`,
  styles: `.wrap { display: grid; place-items: center; padding: 40px 16px; } .box { width: min(100%, 480px); display: flex; flex-direction: column; gap: 14px; padding: 32px; } h1 { font-size: 2rem; } .center { text-align: center; }`,
})
export class ForgotPasswordPage {
  private fb = inject(FormBuilder); private auth = inject(AuthService); private router = inject(Router);
  readonly loading = signal(false); readonly error = signal('');
  readonly form = this.fb.nonNullable.group({ email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]] });
  constructor() { inject(SeoService).set('Forgot password'); }
  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const email = this.form.controls.email.value.trim().toLowerCase();
    this.loading.set(true); this.error.set('');
    this.auth.forgotPassword(email).subscribe({
      // Same next step whether or not the address has an account, so this page cannot be used to find out who is registered.
      next: r => { void this.router.navigate(['/reset-password'], { queryParams: { email, expires: r.expiresInSeconds } }); },
      error: (e: ApiError) => { this.loading.set(false); this.error.set(applyServerErrors(this.form, e)); },
    });
  }
}