import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError, PasswordResetCodeSent } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { applyServerErrors, passwordsMatch } from '../../core/util/forms';
import { FieldComponent } from '../../shared/ui/field.component';
import { IconComponent } from '../../shared/ui/icon.component';

type Step = 'email' | 'code' | 'password';

/**
 * Password recovery in three stages on ONE page, so nothing secret ever appears in the URL:
 *  1. email     — POST /auth/password/forgot  (same answer whether or not an account uses the address)
 *  2. code      — POST /auth/password/verify  (6-digit e-mailed code, expiry countdown, resend after a cooldown) -> single-use reset token
 *  3. password  — POST /auth/password/reset   (reset token + new password). The form is not rendered before stage 2 succeeded.
 * The reset token is kept in memory only (never in the URL, localStorage or history). The backend enforces every rule independently:
 * hiding the form is UX, not security.
 */
@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink, FieldComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="wrap"><div class="box card card--pad">
    <p class="eyebrow">Password recovery</p>
    <ol class="steps" aria-label="Progress">
      @for (s of steps; track s.id; let i = $index) {
        <li [class.is-done]="stepIndex() > i" [class.is-current]="stepIndex() === i" [attr.aria-current]="stepIndex() === i ? 'step' : null">
          <span class="dot" aria-hidden="true">{{ stepIndex() > i ? '✓' : i + 1 }}</span><span class="lbl">{{ s.label }}</span>
        </li>
      }
    </ol>

    @switch (step()) {
      @case ('email') {
        <h1>Forgot your password?</h1>
        <p class="muted">Enter the email of your account. If it is registered, we will send you a 6-digit code.</p>
        <form [formGroup]="emailForm" (ngSubmit)="submitEmail()" class="stack" novalidate>
          <app-field label="Email" [control]="emailForm.controls.email" [required]="true">
            <input class="input" type="email" formControlName="email" autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false" />
          </app-field>
          @if (error()) { <div class="notice notice--error" role="alert">{{ error() }}</div> }
          <button class="btn btn--primary btn--lg" type="submit" [disabled]="loading()">{{ loading() ? 'Sending…' : 'Send me a code' }}</button>
        </form>
        <p class="small muted center"><a routerLink="/login">Back to sign in</a></p>
      }

      @case ('code') {
        <h1>Check your email</h1>
        <p class="muted">If an account uses <strong class="addr">{{ email() }}</strong>, we sent it a 6-digit code. Check your spam folder if you do not see it.</p>
        <form [formGroup]="codeForm" (ngSubmit)="submitCode()" class="stack" novalidate>
          <app-field label="Verification code" [control]="codeForm.controls.otp" [required]="true">
            <input class="input code" formControlName="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456" aria-label="6-digit verification code" (input)="digitsOnly($event)" />
          </app-field>
          @if (otpRemaining() > 0) {
            <p class="timer small muted" role="timer" aria-live="off">The code expires in <strong>{{ clock(otpRemaining()) }}</strong></p>
          } @else {
            <div class="notice notice--warn" role="status">This code has expired. Send a new one to continue.</div>
          }
          @if (error()) { <div class="notice notice--error" role="alert">{{ error() }}</div> }
          @if (info()) { <div class="notice notice--info" role="status">{{ info() }}</div> }
          <button class="btn btn--primary btn--lg" type="submit" [disabled]="loading() || otpRemaining() === 0">{{ loading() ? 'Verifying…' : 'Verify code' }}</button>
        </form>
        <p class="small muted center">Did not get it?
          <button type="button" class="link" (click)="resend()" [disabled]="cooldownRemaining() > 0 || resending() || loading()">{{ cooldownRemaining() > 0 ? 'Resend in ' + cooldownRemaining() + ' s' : resending() ? 'Sending…' : 'Send a new code' }}</button>
          · <button type="button" class="link" (click)="restart('')">Use a different email</button></p>
      }

      @case ('password') {
        <h1>Choose a new password</h1>
        <p class="muted">Code verified. Choose a new password for <strong class="addr">{{ email() }}</strong>. You have <strong>{{ clock(tokenRemaining()) }}</strong> to finish.</p>
        <form [formGroup]="passwordForm" (ngSubmit)="submitPassword()" class="stack" novalidate>
          <app-field label="New password" [control]="passwordForm.controls.password" [required]="true" hint="8 to 72 characters">
            <span class="pw">
              <input class="input" [type]="showNew() ? 'text' : 'password'" formControlName="password" autocomplete="new-password" />
              <button type="button" class="pw__toggle" (click)="showNew.set(!showNew())" [attr.aria-label]="showNew() ? 'Hide password' : 'Show password'" [attr.aria-pressed]="showNew()"><app-icon [name]="showNew() ? 'eye-off' : 'eye'" [size]="18" /></button>
            </span>
          </app-field>
          <app-field label="Confirm new password" [control]="passwordForm" [required]="true">
            <span class="pw">
              <input class="input" [type]="showConfirm() ? 'text' : 'password'" formControlName="confirm" autocomplete="new-password" />
              <button type="button" class="pw__toggle" (click)="showConfirm.set(!showConfirm())" [attr.aria-label]="showConfirm() ? 'Hide password' : 'Show password'" [attr.aria-pressed]="showConfirm()"><app-icon [name]="showConfirm() ? 'eye-off' : 'eye'" [size]="18" /></button>
            </span>
          </app-field>
          @if (error()) { <div class="notice notice--error" role="alert">{{ error() }}</div> }
          <button class="btn btn--primary btn--lg" type="submit" [disabled]="loading()">{{ loading() ? 'Saving…' : 'Change password' }}</button>
        </form>
        <p class="small muted center"><button type="button" class="link" (click)="restart('')">Start over</button></p>
      }
    }
  </div></div>`,
  styles: `
  .wrap { display: grid; place-items: center; padding: 40px 16px; }
  .box { width: min(100%, 480px); display: flex; flex-direction: column; gap: 14px; padding: 32px; }
  h1 { font-size: 2rem; } .center { text-align: center; } .addr { overflow-wrap: anywhere; }
  .code { font-size: 1.6rem; letter-spacing: .5em; text-align: center; font-variant-numeric: tabular-nums; }
  .timer { margin: 0; text-align: center; font-variant-numeric: tabular-nums; }
  .link { background: none; border: 0; padding: 0; color: var(--c-primary-text); text-decoration: underline; cursor: pointer; font: inherit; } .link:disabled { opacity: .6; cursor: default; text-decoration: none; }
  .steps { list-style: none; display: flex; gap: 8px; margin: 0; padding: 0; }
  .steps li { flex: 1; display: flex; align-items: center; gap: 8px; min-width: 0; font-size: var(--fs-xs); color: var(--c-text-subtle); }
  .steps .dot { flex: none; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; font-weight: 600; border: 1px solid var(--c-border-strong); background: var(--c-surface); }
  .steps .lbl { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .steps .is-current { color: var(--c-text); font-weight: 600; } .steps .is-current .dot { background: var(--c-primary-600); border-color: var(--c-primary-600); color: #fff; }
  .steps .is-done .dot { background: var(--c-success-bg); border-color: var(--c-success); color: var(--c-success); }
  .pw { position: relative; display: block; } .pw .input { padding-right: 46px; }
  .pw__toggle { position: absolute; top: 0; right: 0; bottom: 0; width: 44px; display: grid; place-items: center; background: none; border: 0; cursor: pointer; color: var(--c-text-muted); border-radius: 0 var(--r-md) var(--r-md) 0; }
  .pw__toggle:hover { color: var(--c-text); } .pw__toggle:focus-visible { outline: 2px solid var(--c-primary-600); outline-offset: -2px; }
  @media (max-width: 480px) { .box { padding: 20px; } h1 { font-size: 1.6rem; } .steps .lbl { display: none; } .steps li.is-current .lbl { display: inline; } .code { letter-spacing: .35em; } }`,
})
export class ForgotPasswordPage {
  private fb = inject(FormBuilder); private auth = inject(AuthService); private router = inject(Router);

  readonly steps: { id: Step; label: string }[] = [{ id: 'email', label: 'Email' }, { id: 'code', label: 'Code' }, { id: 'password', label: 'New password' }];
  readonly step = signal<Step>('email');
  readonly stepIndex = computed(() => this.steps.findIndex(s => s.id === this.step()));
  readonly email = signal('');
  readonly loading = signal(false); readonly resending = signal(false);
  readonly error = signal(''); readonly info = signal('');
  readonly showNew = signal(false); readonly showConfirm = signal(false);

  /** Held in memory only. Without it the password step is never shown and the backend would refuse the request anyway. */
  private readonly resetToken = signal('');
  // Absolute deadlines (ms since epoch), compared against a once-a-second clock: robust against throttled background tabs.
  private readonly now = signal(Date.now());
  private readonly otpDeadline = signal(0); private readonly cooldownDeadline = signal(0); private readonly tokenDeadline = signal(0);
  readonly otpRemaining = computed(() => this.secondsUntil(this.otpDeadline()));
  readonly cooldownRemaining = computed(() => this.secondsUntil(this.cooldownDeadline()));
  readonly tokenRemaining = computed(() => this.secondsUntil(this.tokenDeadline()));

  readonly emailForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254), Validators.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)]],
  });
  readonly codeForm = this.fb.nonNullable.group({ otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]] });
  readonly passwordForm = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
    confirm: ['', Validators.required],
  }, { validators: passwordsMatch('password', 'confirm') });

  constructor() {
    inject(SeoService).set('Forgot password');
    const tick = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(tick));
    // The reset authorisation is short-lived: when it runs out the person is taken back to the start instead of hitting a refusal.
    effect(() => { if (this.step() === 'password' && this.tokenRemaining() === 0) this.restart('Your verification expired. Please start again.'); });
  }

  /** m:ss */
  clock(seconds: number): string { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
  private secondsUntil(deadline: number): number { return Math.max(0, Math.ceil((deadline - this.now()) / 1000)); }

  // ── stage 1 ──────────────────────────────────────────────────────────────
  submitEmail(): void {
    if (this.loading()) return;
    if (this.emailForm.invalid) { this.emailForm.markAllAsTouched(); return; }
    const address = this.emailForm.controls.email.value.trim().toLowerCase();
    this.loading.set(true); this.error.set(''); this.info.set('');
    this.auth.forgotPassword(address).subscribe({
      // The same next step whether or not the address has an account, so this page cannot be used to find out who is registered.
      next: r => { this.loading.set(false); this.email.set(address); this.startCode(r); this.step.set('code'); },
      error: (e: unknown) => { this.loading.set(false); this.error.set(applyServerErrors(this.emailForm, e)); },
    });
  }

  // ── stage 2 ──────────────────────────────────────────────────────────────
  digitsOnly(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 6);
    if (digits !== input.value) input.value = digits;
    this.codeForm.controls.otp.setValue(digits);
  }

  submitCode(): void {
    if (this.loading()) return;
    if (this.otpRemaining() === 0) { this.error.set('This code has expired. Send a new one.'); return; }
    if (this.codeForm.invalid) { this.codeForm.markAllAsTouched(); this.error.set('Enter the 6 digits from the email.'); return; }
    this.loading.set(true); this.error.set(''); this.info.set('');
    this.auth.verifyResetCode(this.email(), this.codeForm.controls.otp.value).subscribe({
      next: g => {
        this.loading.set(false);
        this.resetToken.set(g.resetToken); this.tokenDeadline.set(Date.now() + g.expiresInSeconds * 1000); this.now.set(Date.now());
        this.codeForm.reset(); this.step.set('password');
      },
      error: (e: unknown) => {
        this.loading.set(false); this.codeForm.controls.otp.reset();
        this.error.set(applyServerErrors(this.codeForm, e));
        if (e instanceof ApiError && e.retryAfterSeconds) this.cooldownDeadline.set(Date.now() + e.retryAfterSeconds * 1000); // too many wrong codes: ask for a new one
      },
    });
  }

  resend(): void {
    if (this.resending() || this.loading() || this.cooldownRemaining() > 0) return;
    this.resending.set(true); this.error.set(''); this.info.set('');
    this.auth.resendResetCode(this.email()).subscribe({
      next: r => { this.resending.set(false); this.startCode(r); this.info.set('If an account uses this email, a new code is on its way. Older codes no longer work.'); },
      error: (e: unknown) => {
        this.resending.set(false); this.error.set(applyServerErrors(this.codeForm, e));
        if (e instanceof ApiError && e.retryAfterSeconds) this.cooldownDeadline.set(Date.now() + e.retryAfterSeconds * 1000);
      },
    });
  }

  // ── stage 3 ──────────────────────────────────────────────────────────────
  submitPassword(): void {
    if (this.loading()) return;
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      this.error.set(this.passwordForm.errors?.['mismatch'] ? 'The two passwords do not match.' : 'Choose a new password of 8 to 72 characters.');
      return;
    }
    const token = this.resetToken();
    if (!token) { this.restart('Please verify your email first.'); return; }
    this.loading.set(true); this.error.set('');
    this.auth.resetPassword(this.email(), token, this.passwordForm.controls.password.value).subscribe({
      next: () => { this.resetToken.set(''); void this.router.navigate(['/login'], { queryParams: { reset: 1 } }); },
      error: (e: unknown) => {
        this.loading.set(false);
        if (e instanceof ApiError && e.code === 'INVALID_RESET_TOKEN') { this.restart(e.message); return; } // expired or already used: the only way forward is a new code
        this.error.set(applyServerErrors(this.passwordForm, e));
      },
    });
  }

  /** Back to stage 1, forgetting everything secret. */
  restart(message: string): void {
    const previous = this.email();
    this.resetToken.set(''); this.tokenDeadline.set(0); this.otpDeadline.set(0); this.cooldownDeadline.set(0);
    this.codeForm.reset(); this.passwordForm.reset(); this.showNew.set(false); this.showConfirm.set(false);
    this.loading.set(false); this.resending.set(false); this.info.set(''); this.error.set(message);
    this.emailForm.controls.email.setValue(previous);
    this.step.set('email');
  }

  private startCode(r: PasswordResetCodeSent): void {
    const t = Date.now();
    this.now.set(t);
    this.otpDeadline.set(t + r.expiresInSeconds * 1000);
    this.cooldownDeadline.set(t + r.resendAfterSeconds * 1000);
    this.codeForm.reset(); this.error.set('');
  }
}