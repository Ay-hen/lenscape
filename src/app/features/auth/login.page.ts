import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { applyServerErrors } from '../../core/util/forms';
import { FieldComponent } from '../../shared/ui/field.component';
import { SeoService } from '../../core/seo.service';
import { SplashService } from '../../core/Splash.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, FieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="page"><section class="art" aria-hidden="true"><img src="img/login-lens.jpg" alt="" /><div class="shade"></div><blockquote>“The right photographer turns a day into a story.”</blockquote></section>
  <section class="form"><div class="box"><h1>Welcome back</h1><p class="muted">Sign in to manage bookings, favourites and your studio.</p>
    @if (expired) { <div class="notice notice--warn" role="status">Your session expired. Please sign in again.</div> }
    <form [formGroup]="form" (ngSubmit)="submit()" class="stack" novalidate>
      <app-field label="Username or email" [control]="form.controls.username" [required]="true"><input class="input" formControlName="username" autocomplete="username" [attr.aria-invalid]="form.controls.username.invalid && form.controls.username.touched" /></app-field>
      <app-field label="Password" [control]="form.controls.password" [required]="true"><input class="input" type="password" formControlName="password" autocomplete="current-password" /></app-field>
      @if (error()) { <div class="notice notice--error" role="alert">{{ error() }}</div> }
      <button class="btn btn--primary btn--lg btn--block" type="submit" [disabled]="loading()">{{ loading() ? 'Signing in…' : 'Sign in' }}</button>
    </form>
    <p class="small muted center">New here? <a routerLink="/register">Create an account</a> · <a routerLink="/register/photographer">Join as a photographer</a></p></div></section></div>`,
  styles: `.page { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); min-height: calc(100vh - var(--header-h)); } .art { position: relative; overflow: hidden; } .art img { width: 100%; height: 100%; object-fit: cover; position: absolute; inset: 0; } .shade { position: absolute; inset: 0; background: linear-gradient(180deg, transparent 30%, rgb(7 14 34 / 78%)); }
  blockquote { position: absolute; left: 40px; right: 40px; bottom: 48px; margin: 0; color: #fff; font-family: var(--font-display); font-size: clamp(1.4rem, 2.4vw, 2rem); line-height: 1.25; }
  .form { display: grid; place-items: center; padding: 32px 20px; } .box { width: min(100%, 420px); display: flex; flex-direction: column; gap: 18px; } h1 { font-size: 2rem; } .center { text-align: center; }
  @media (max-width: 900px) { .page { grid-template-columns: minmax(0, 1fr); } .art { display: none; } }`,
})
export class LoginPage {
  private fb = inject(FormBuilder); private auth = inject(AuthService); private router = inject(Router); private route = inject(ActivatedRoute);
  readonly loading = signal(false); readonly error = signal('');
  readonly expired = !!this.route.snapshot.queryParamMap.get('expired');
  readonly form = this.fb.nonNullable.group({ username: ['', Validators.required], password: ['', Validators.required] });
  private splash = inject(SplashService);
  constructor() { inject(SeoService).set('Sign in'); }
  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true); this.error.set('');
    this.auth.login(this.form.getRawValue()).subscribe({
      next: s => { this.splash.show(); const ret = this.route.snapshot.queryParamMap.get('returnUrl'); void this.router.navigateByUrl(ret && ret.startsWith('/') && !ret.startsWith('//') ? ret : this.auth.homeFor(s.role)); },
      error: e => { this.loading.set(false); this.error.set(applyServerErrors(this.form, e)); },
    });
  }
}