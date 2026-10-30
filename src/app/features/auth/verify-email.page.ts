import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { FieldComponent } from '../../shared/ui/field.component';

/** Step 2 of sign-up: the person enters the 6-digit code that was e-mailed; only then does the account exist. */
@Component({
  selector: 'app-verify-email',
  imports: [ReactiveFormsModule, RouterLink, FieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="wrap"><div class="box card card--pad"><p class="eyebrow">Verify your email</p>
    <h1>Enter your code</h1>
    @if (email()) {
      <p class="muted">We sent a 6-digit code to <strong>{{ email() }}</strong>. It expires in {{ minutes }} minutes. Check your spam folder if you do not see it.</p>
      <form [formGroup]="form" (ngSubmit)="submit()" class="stack" novalidate>
        <app-field label="Verification code" [control]="form.controls.otp" [required]="true">
          <input class="input code" formControlName="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456" aria-label="6-digit verification code" />
        </app-field>
        @if (error()) { <div class="notice notice--error" role="alert">{{ error() }}</div> }
        @if (info()) { <div class="notice" role="status">{{ info() }}</div> }
        <button class="btn btn--primary btn--lg" type="submit" [disabled]="loading()">{{ loading() ? 'Verifying…' : 'Verify and continue' }}</button>
      </form>
      <p class="small muted center">Did not get it?
        <button type="button" class="link" (click)="resend()" [disabled]="cooldown() > 0 || sending()">{{ cooldown() > 0 ? 'Resend in ' + cooldown() + ' s' : sending() ? 'Sending…' : 'Send a new code' }}</button>
        · <a routerLink="/register">Use a different email</a></p>
    } @else {
      <p class="muted">This page needs the email you registered with. <a routerLink="/register">Start again</a>.</p>
    }
  </div></div>`,
  styles: `.wrap { display: grid; place-items: center; padding: 40px 16px; } .box { width: min(100%, 480px); display: flex; flex-direction: column; gap: 14px; padding: 32px; } h1 { font-size: 2rem; }
  .center { text-align: center; } .code { font-size: 1.6rem; letter-spacing: .5em; text-align: center; font-variant-numeric: tabular-nums; }
  .link { background: none; border: 0; padding: 0; color: var(--c-primary, inherit); text-decoration: underline; cursor: pointer; font: inherit; } .link:disabled { opacity: .6; cursor: default; text-decoration: none; }`,
})
export class VerifyEmailPage implements OnDestroy {
  private fb = inject(FormBuilder); private auth = inject(AuthService); private router = inject(Router); private route = inject(ActivatedRoute);
  readonly email = signal(this.route.snapshot.queryParamMap.get('email') ?? '');
  readonly minutes = Math.max(1, Math.round(Number(this.route.snapshot.queryParamMap.get('expires') || 600) / 60));
  readonly loading = signal(false); readonly sending = signal(false); readonly error = signal(''); readonly info = signal(''); readonly cooldown = signal(60);
  readonly form = this.fb.nonNullable.group({ otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]] });
  private timer = setInterval(() => this.cooldown.update(c => Math.max(0, c - 1)), 1000);

  constructor() { inject(SeoService).set('Verify your email'); }
  ngOnDestroy(): void { clearInterval(this.timer); }

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); this.error.set('Enter the 6 digits from the email.'); return; }
    this.loading.set(true); this.error.set(''); this.info.set('');
    this.auth.verifyEmail(this.email(), this.form.controls.otp.value).subscribe({
      next: s => void this.router.navigateByUrl(this.auth.homeFor(s.role)),
      error: (e: ApiError) => { this.loading.set(false); this.error.set(this.message(e)); if (e.retryAfterSeconds) this.cooldown.set(e.retryAfterSeconds); },
    });
  }

  resend() {
    this.sending.set(true); this.error.set(''); this.info.set('');
    this.auth.resendCode(this.email()).subscribe({
      next: () => { this.sending.set(false); this.cooldown.set(60); this.form.reset(); this.info.set('If a registration is pending for this email, a new code is on its way. Older codes no longer work.'); },
      error: (e: ApiError) => { this.sending.set(false); this.error.set(this.message(e)); if (e.retryAfterSeconds) this.cooldown.set(e.retryAfterSeconds); },
    });
  }

  private message(e: ApiError): string {
    if (e.details?.['username']) return e.message; // the username was taken meanwhile: tell the person to register again
    return e.message || 'Something went wrong. Please try again.';
  }
}
