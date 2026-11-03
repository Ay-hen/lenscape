import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { applyServerErrors, passwordsMatch } from '../../core/util/forms';
import { FieldComponent } from '../../shared/ui/field.component';

/** Password recovery, step 2: the e-mailed code + the new password. Afterwards the person signs in again (all old sessions are revoked). */
@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink, FieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="wrap"><div class="box card card--pad"><p class="eyebrow">Password recovery</p>
    <h1>Choose a new password</h1>
    @if (email()) {
      <p class="muted">If an account uses <strong>{{ email() }}</strong>, we sent it a 6-digit code. It expires in {{ minutes }} minutes. Check your spam folder if you do not see it.</p>
      <form [formGroup]="form" (ngSubmit)="submit()" class="stack" novalidate>
        <app-field label="Code" [control]="form.controls.otp" [required]="true">
          <input class="input code" formControlName="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456" aria-label="6-digit code" />
        </app-field>
        <app-field label="New password" [control]="form.controls.password" [required]="true" hint="8 to 72 characters"><input class="input" type="password" formControlName="password" autocomplete="new-password" /></app-field>
        <app-field label="Confirm new password" [control]="form" [required]="true"><input class="input" type="password" formControlName="confirm" autocomplete="new-password" /></app-field>
        @if (error()) { <div class="notice notice--error" role="alert">{{ error() }}</div> }
        @if (info()) { <div class="notice" role="status">{{ info() }}</div> }
        <button class="btn btn--primary btn--lg" type="submit" [disabled]="loading()">{{ loading() ? 'Saving…' : 'Change password' }}</button>
      </form>
      <p class="small muted center">Did not get a code?
        <button type="button" class="link" (click)="resend()" [disabled]="cooldown() > 0 || sending()">{{ cooldown() > 0 ? 'Resend in ' + cooldown() + ' s' : sending() ? 'Sending…' : 'Send a new code' }}</button>
        · <a routerLink="/forgot-password">Use a different email</a></p>
    } @else {
      <p class="muted">This page needs the email of your account. <a routerLink="/forgot-password">Start again</a>.</p>
    }
  </div></div>`,
  styles: `.wrap { display: grid; place-items: center; padding: 40px 16px; } .box { width: min(100%, 480px); display: flex; flex-direction: column; gap: 14px; padding: 32px; } h1 { font-size: 2rem; }
  .center { text-align: center; } .code { font-size: 1.6rem; letter-spacing: .5em; text-align: center; font-variant-numeric: tabular-nums; }
  .link { background: none; border: 0; padding: 0; color: var(--c-primary-text); text-decoration: underline; cursor: pointer; font: inherit; } .link:disabled { opacity: .6; cursor: default; text-decoration: none; }`,
})
export class ResetPasswordPage implements OnDestroy {
  private fb = inject(FormBuilder); private auth = inject(AuthService); private router = inject(Router); private route = inject(ActivatedRoute);
  readonly email = signal(this.route.snapshot.queryParamMap.get('email') ?? '');
  readonly minutes = Math.max(1, Math.round(Number(this.route.snapshot.queryParamMap.get('expires') || 600) / 60));
  readonly loading = signal(false); readonly sending = signal(false); readonly error = signal(''); readonly info = signal(''); readonly cooldown = signal(60);
  readonly form = this.fb.nonNullable.group({
    otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
    confirm: ['', Validators.required],
  }, { validators: passwordsMatch('password', 'confirm') });
  private timer = setInterval(() => this.cooldown.update(c => Math.max(0, c - 1)), 1000);

  constructor() { inject(SeoService).set('Choose a new password'); }
  ngOnDestroy(): void { clearInterval(this.timer); }

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); this.error.set(this.form.errors?.['mismatch'] ? 'The two passwords do not match.' : 'Enter the 6-digit code and a new password of 8 to 72 characters.'); return; }
    this.loading.set(true); this.error.set(''); this.info.set('');
    const v = this.form.getRawValue();
    this.auth.resetPassword(this.email(), v.otp, v.password).subscribe({
      next: () => { void this.router.navigate(['/login'], { queryParams: { reset: 1 } }); },
      error: (e: ApiError) => { this.loading.set(false); this.error.set(applyServerErrors(this.form, e)); if (e.retryAfterSeconds) this.cooldown.set(e.retryAfterSeconds); },
    });
  }

  resend() {
    this.sending.set(true); this.error.set(''); this.info.set('');
    this.auth.forgotPassword(this.email()).subscribe({
      next: () => { this.sending.set(false); this.cooldown.set(60); this.form.controls.otp.reset(); this.info.set('If an account uses this email, a new code is on its way. Older codes no longer work.'); },
      error: (e: ApiError) => { this.sending.set(false); this.error.set(e.message); if (e.retryAfterSeconds) this.cooldown.set(e.retryAfterSeconds); },
    });
  }
}