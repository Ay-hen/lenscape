import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthRepository } from '../../core/api/repositories';
import { authInterceptor, errorInterceptor } from '../../core/auth/interceptors';
import { APP_ENV } from '../../core/config/app-config';
import { environment } from '../../core/config/environment';
import { HttpAuthRepository } from '../../core/http/http-auth.repository';
import { ForgotPasswordPage } from './forgot-password.page';

@Component({ template: '' })
class Blank {}

const API = environment.apiBaseUrl;
const EMAIL = 'alice@example.com';
const sent = { message: 'If an account uses this email, we sent a 6-digit code to it.', expiresInSeconds: 300, resendAfterSeconds: 60 };
const TOKEN = 'dGhpcy1pcy1hLXJlc2V0LXRva2VuLTEyMzQ1Njc4OTA';

/**
 * The page runs against the REAL HttpAuthRepository and the REAL interceptors; only the network is replaced. The answers below follow the
 * documented backend contract (docs/ENDPOINTS.md), so a change to a URL, a field name or the error mapping fails here.
 */
describe('ForgotPasswordPage (password recovery)', () => {
  let fixture: ComponentFixture<ForgotPasswordPage>;
  let el: HTMLElement;
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  const q = <T extends HTMLElement = HTMLElement>(sel: string) => el.querySelector<T>(sel);
  const type = (sel: string, value: string) => { const i = q<HTMLInputElement>(sel)!; i.value = value; i.dispatchEvent(new Event('input')); fixture.detectChanges(); };
  const submit = () => { q('form')!.dispatchEvent(new Event('submit')); fixture.detectChanges(); };
  const click = (sel: string) => { q<HTMLButtonElement>(sel)!.click(); fixture.detectChanges(); };
  const text = () => el.textContent ?? '';
  const answer = (req: TestRequest, body: object, status = 200) => { req.flush(body, { status, statusText: String(status) }); fixture.detectChanges(); };
  const expectPost = (path: string, body: unknown) => { const r = http.expectOne(API + path); expect(r.request.method).toBe('POST'); expect(r.request.body).toEqual(body); return r; };
  const tick = (ms: number) => { vi.advanceTimersByTime(ms); fixture.detectChanges(); };
  const resendButton = () => Array.from(el.querySelectorAll<HTMLButtonElement>('button.link')).find(b => /resend|new code|sending/i.test(b.textContent ?? ''))!;
  const verifyButton = () => q<HTMLButtonElement>('form button[type=submit]')!;

  /** Walks stage 1 so that the page waits for the code. */
  const reachCodeStep = () => {
    type('input[type=email]', `  ${EMAIL.toUpperCase()} `);
    submit();
    answer(expectPost('/auth/password/forgot', { email: EMAIL }), sent);
  };
  /** Walks stage 2 so that the page shows the password form. */
  const reachPasswordStep = () => {
    reachCodeStep();
    type('input.code', '123456');
    submit();
    answer(expectPost('/auth/password/verify', { email: EMAIL, otp: '123456' }), { resetToken: TOKEN, expiresInSeconds: 600 });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'login', component: Blank }]),
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])), provideHttpClientTesting(),
        { provide: APP_ENV, useValue: environment },
        { provide: AuthRepository, useClass: HttpAuthRepository },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ForgotPasswordPage);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => { http.verify(); fixture.destroy(); vi.useRealTimers(); });

  // ── stage 1 ───────────────────────────────────────────────────────────────
  it('starts with only the email field and a way back to sign in', () => {
    expect(q('input[type=email]')).not.toBeNull();
    expect(q('input.code')).toBeNull();
    expect(q('input[formControlName=password]')).toBeNull();
    expect(q<HTMLAnchorElement>('a[href="/login"]')).not.toBeNull();
  });

  it('refuses a missing or malformed email without calling the server', () => {
    submit();
    expect(text()).toContain('Email is required');
    for (const bad of ['plainaddress', 'a@b', 'a b@c.com']) {
      type('input[type=email]', bad); submit();
      expect(q('input.code')).toBeNull();
    }
    http.expectNone(API + '/auth/password/forgot');
  });

  it('sends the trimmed lower-case address and moves on with the same screen for ANY address (no account enumeration)', () => {
    reachCodeStep();
    expect(q('input.code')).not.toBeNull();
    expect(text()).toContain('If an account uses');
    expect(text()).toContain(EMAIL);
  });

  it('shows a network failure and stays on the email step so the person can retry', () => {
    type('input[type=email]', EMAIL); submit();
    http.expectOne(API + '/auth/password/forgot').error(new ProgressEvent('error'), { status: 0 });
    fixture.detectChanges();
    expect(text()).toContain('Cannot reach the server');
    expect(q('input[type=email]')).not.toBeNull();
    expect(verifyButton().disabled).toBe(false);
  });

  it('shows a server-side validation error next to the field', () => {
    type('input[type=email]', EMAIL); submit();
    answer(http.expectOne(API + '/auth/password/forgot'), { code: 'VALIDATION', message: 'Please fix the highlighted fields.', errors: { email: 'Please provide a valid email address' } }, 400);
    expect(text()).toContain('Please fix the highlighted fields.');
    expect(text()).toContain('Please provide a valid email address');
  });

  it('ignores a second click while the first request is still running (no duplicate submission)', () => {
    type('input[type=email]', EMAIL);
    submit(); submit(); submit();
    http.expectOne(API + '/auth/password/forgot'); // exactly one request
    expect(verifyButton().disabled).toBe(true);
    expect(verifyButton().textContent).toContain('Sending');
    http.verify();
  });

  // ── stage 2 ───────────────────────────────────────────────────────────────
  it('does NOT show the password fields while the code is unverified', () => {
    reachCodeStep();
    expect(q('input[formControlName=password]')).toBeNull();
    expect(q('input[formControlName=confirm]')).toBeNull();
    type('input.code', '12');
    submit();
    expect(text()).toContain('Enter the 6 digits');
    http.expectNone(API + '/auth/password/verify');
    expect(q('input[formControlName=password]')).toBeNull();
  });

  it('keeps only digits in the code field', () => {
    reachCodeStep();
    type('input.code', '12a-3 4b5678');
    expect(q<HTMLInputElement>('input.code')!.value).toBe('123456');
  });

  it('rejects a wrong code, stays on the code step and clears the field', () => {
    reachCodeStep();
    type('input.code', '000000'); submit();
    answer(expectPost('/auth/password/verify', { email: EMAIL, otp: '000000' }), { code: 'INVALID_CODE', message: 'Invalid or expired code' }, 400);
    expect(text()).toContain('Invalid or expired code');
    expect(q('input.code')).not.toBeNull();
    expect(q<HTMLInputElement>('input.code')!.value).toBe('');
    expect(q('input[formControlName=password]')).toBeNull();
  });

  it('after too many wrong codes the person must ask for a new one (429 + Retry-After)', () => {
    reachCodeStep();
    tick(61_000); // cooldown over
    type('input.code', '000000'); submit();
    answer(http.expectOne(API + '/auth/password/verify'), { code: 'RATE_LIMITED', message: 'Too many incorrect attempts. Request a new code.', retryAfterSeconds: 60 }, 429);
    expect(text()).toContain('Too many incorrect attempts');
    expect(resendButton().disabled).toBe(true);
    expect(resendButton().textContent).toContain('Resend in 60 s');
  });

  it('counts the code down and blocks verification once it has expired', () => {
    reachCodeStep();
    expect(text()).toContain('5:00');
    tick(61_000);
    expect(text()).toContain('3:59');
    tick(240_000);
    expect(text()).toContain('This code has expired');
    expect(verifyButton().disabled).toBe(true);
    type('input.code', '123456'); submit();
    http.expectNone(API + '/auth/password/verify');
  });

  it('offers a resend only after the cooldown; resend restarts both timers and clears the box', () => {
    reachCodeStep();
    expect(resendButton().disabled).toBe(true);
    expect(resendButton().textContent).toContain('Resend in 60 s');
    click('button.link'); // disabled: nothing happens
    http.expectNone(API + '/auth/password/resend');
    tick(30_000);
    expect(resendButton().textContent).toContain('Resend in 30 s');
    tick(31_000);
    expect(resendButton().disabled).toBe(false);
    type('input.code', '123');
    resendButton().click(); fixture.detectChanges();
    answer(expectPost('/auth/password/resend', { email: EMAIL }), sent);
    expect(text()).toContain('a new code is on its way');
    expect(q<HTMLInputElement>('input.code')!.value).toBe('');
    expect(text()).toContain('5:00');
    expect(resendButton().disabled).toBe(true);
  });

  it('"Use a different email" returns to stage 1 and forgets the progress', () => {
    reachCodeStep();
    const buttons = Array.from(el.querySelectorAll<HTMLButtonElement>('button.link'));
    buttons.find(b => /different email/i.test(b.textContent ?? ''))!.click(); fixture.detectChanges();
    expect(q('input[type=email]')).not.toBeNull();
    expect(q('input.code')).toBeNull();
  });

  // ── stage 3 ───────────────────────────────────────────────────────────────
  it('a verified code opens the password form', () => {
    reachPasswordStep();
    expect(q('input[formControlName=password]')).not.toBeNull();
    expect(q('input[formControlName=confirm]')).not.toBeNull();
    expect(q('input.code')).toBeNull();
    expect(text()).toContain('10:00');
  });

  it('refuses mismatching confirmation and too-short passwords without calling the server', () => {
    reachPasswordStep();
    type('input[formControlName=password]', 'Correct-horse-1'); type('input[formControlName=confirm]', 'Correct-horse-2'); submit();
    expect(text()).toContain('The two passwords do not match.');
    type('input[formControlName=password]', 'short'); type('input[formControlName=confirm]', 'short'); submit();
    expect(text()).toContain('8 to 72 characters');
    http.expectNone(API + '/auth/password/reset');
  });

  it('refuses a password of more than 72 characters (BCrypt limit, same rule as sign-up)', () => {
    reachPasswordStep();
    const long = 'a'.repeat(73);
    type('input[formControlName=password]', long); type('input[formControlName=confirm]', long); submit();
    http.expectNone(API + '/auth/password/reset');
  });

  it('can show and hide each password field', () => {
    reachPasswordStep();
    const pw = () => q<HTMLInputElement>('input[formControlName=password]')!;
    const confirm = () => q<HTMLInputElement>('input[formControlName=confirm]')!;
    expect(pw().type).toBe('password'); expect(confirm().type).toBe('password');
    const [toggleNew, toggleConfirm] = Array.from(el.querySelectorAll<HTMLButtonElement>('.pw__toggle'));
    toggleNew.click(); fixture.detectChanges();
    expect(pw().type).toBe('text'); expect(confirm().type).toBe('password');
    expect(toggleNew.getAttribute('aria-label')).toBe('Hide password');
    toggleConfirm.click(); fixture.detectChanges();
    expect(confirm().type).toBe('text');
    toggleNew.click(); fixture.detectChanges();
    expect(pw().type).toBe('password');
  });

  it('changes the password with the reset TOKEN (never the code) and goes to the login page with the success notice', () => {
    reachPasswordStep();
    type('input[formControlName=password]', 'Correct-horse-1'); type('input[formControlName=confirm]', 'Correct-horse-1');
    submit(); submit(); // a double click sends one request
    const req = expectPost('/auth/password/reset', { email: EMAIL, resetToken: TOKEN, password: 'Correct-horse-1' });
    expect(JSON.stringify(req.request.body)).not.toContain('123456');
    expect(verifyButton().disabled).toBe(true);
    answer(req, { message: 'Your password has been changed. Sign in with the new password.' });
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { reset: 1 } });
  });

  it('an expired or already used token sends the person back to the start with an explanation', () => {
    reachPasswordStep();
    type('input[formControlName=password]', 'Correct-horse-1'); type('input[formControlName=confirm]', 'Correct-horse-1'); submit();
    answer(http.expectOne(API + '/auth/password/reset'), { code: 'INVALID_RESET_TOKEN', message: 'This password reset session has expired or was already used. Please start again.' }, 400);
    expect(q('input[type=email]')).not.toBeNull();
    expect(q('input[formControlName=password]')).toBeNull();
    expect(text()).toContain('expired or was already used');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('when the reset authorisation runs out while the form is open, the person is taken back to the start', () => {
    reachPasswordStep();
    tick(601_000);
    expect(q('input[type=email]')).not.toBeNull();
    expect(q('input[formControlName=password]')).toBeNull();
    expect(text()).toContain('Your verification expired');
    http.expectNone(API + '/auth/password/reset');
  });

  it('keeps the secrets out of the address bar, history and storage', () => {
    reachPasswordStep();
    expect(JSON.stringify(Object.entries(localStorage))).not.toContain(TOKEN);
    expect(JSON.stringify(Object.entries(sessionStorage))).not.toContain(TOKEN);
    expect(location.href).not.toContain(TOKEN);
  });
});
