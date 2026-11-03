import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { Injectable, inject } from '@angular/core';
import { guestGuard, roleGuard } from './guards';
import { SessionStore } from './session.store';
import { jwtPayload } from './jwt';
import { AuthRepository } from '../api/repositories';
import { APP_ENV } from '../config/app-config';
import { environment } from '../config/environment';
import { ApiError, Role, Session, User } from '../models';

// A stand-in for GET /user/me: it answers from a fixed account table, the way the Spring Boot API answers from its database.
// The guards are a UX layer: the backend still authorises every API call.
const accounts: Record<string, User> = {};
const account = (username: string, role: Role, status: User['status'] = 'active'): User => (accounts[username] = { id: username, role, name: username, username, email: `${username}@example.com`, status, createdAt: '2026-01-01T00:00:00Z' });
const jwt = (sub: string, expInSeconds = 3600) => ['h', btoa(JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + expInSeconds })).replace(/=+$/, ''), 's'].join('.');
const sessionFor = (u: User, token = jwt(u.username)): Session => ({ token, role: u.role, user: u });

let meCalls = 0;
@Injectable()
class FakeAuthRepository extends AuthRepository {
  private store = inject(SessionStore);
  login(): Observable<Session> { return throwError(() => new Error('not used')); }
  registerCustomer(): Observable<never> { return throwError(() => new Error('not used')); }
  registerPhotographer(): Observable<never> { return throwError(() => new Error('not used')); }
  verifyEmail(): Observable<Session> { return throwError(() => new Error('not used')); }
  resendCode(): Observable<void> { return of(undefined); }
  logout(): Observable<void> { return of(undefined); }
  changePassword(): Observable<void> { return of(undefined); }
  me(): Observable<User> {
    meCalls++;
    const sub = jwtPayload(this.store.token() ?? '')?.sub ?? '';
    const u = accounts[sub];
    return u ? of(u) : throwError(() => new ApiError('UNAUTHENTICATED', 'Sign in required.', 401));
  }

  forgotPassword(): Observable<{ expiresInSeconds: number }> { return of({ expiresInSeconds: 600 }); }
  resetPassword(): Observable<void> { return of(undefined); }
}

const run = (g: ReturnType<typeof roleGuard>) =>
  firstValueFrom(TestBed.runInInjectionContext(() => (g as (...a: unknown[]) => unknown)({}, { url: '/studio' })) as Observable<boolean | UrlTree>);
const url = (r: boolean | UrlTree) => TestBed.inject(Router).serializeUrl(r as UrlTree);

describe('route guards (UX only — the backend must enforce access)', () => {
  beforeEach(() => {
    localStorage.clear(); meCalls = 0;
    for (const k of Object.keys(accounts)) delete accounts[k];
    account('priya', 'photographer'); account('carla', 'client'); account('root', 'admin');
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: APP_ENV, useValue: environment }, { provide: AuthRepository, useClass: FakeAuthRepository }] });
  });

  it('sends anonymous visitors to /login with a return URL', async () => {
    expect(url(await run(roleGuard('photographer')))).toBe('/login?returnUrl=%2Fstudio');
  });

  it('lets a backend-confirmed photographer into the studio', async () => {
    TestBed.inject(SessionStore).set(sessionFor(accounts['priya']));
    expect(await run(roleGuard('photographer'))).toBe(true);
  });

  it('sends a genuine customer who types /studio to their own area', async () => {
    TestBed.inject(SessionStore).set(sessionFor(accounts['carla']));
    expect(url(await run(roleGuard('photographer')))).toBe('/account');
  });

  it('does not let a customer upgrade themselves by editing the stored role', async () => {
    const store = TestBed.inject(SessionStore);
    store.set(sessionFor({ ...accounts['carla'], role: 'photographer' })); // what DevTools editing would do
    expect(url(await run(roleGuard('photographer')))).toBe('/account');
    expect(store.role()).toBe('client'); // the backend's role replaced the forged one
  });

  it('rejects a stored session for an account that does not exist', async () => {
    const store = TestBed.inject(SessionStore);
    store.set(sessionFor({ ...accounts['priya'], id: 'ghost', username: 'ghost' }));
    expect(url(await run(roleGuard('photographer')))).toBe('/login?returnUrl=%2Fstudio');
    expect(store.session()).toBeNull();
  });

  it("rejects a session whose token belongs to a different account (e.g. borrowing the admin's)", async () => {
    const store = TestBed.inject(SessionStore);
    store.set(sessionFor(accounts['priya'], jwt('root')));
    expect(url(await run(roleGuard('photographer')))).toBe('/login?returnUrl=%2Fstudio');
    expect(store.session()).toBeNull();
  });

  it('rejects an expired token without calling the backend', async () => {
    const store = TestBed.inject(SessionStore);
    store.set(sessionFor(accounts['priya'], jwt('priya', -60)));
    expect(url(await run(roleGuard('photographer')))).toBe('/login?returnUrl=%2Fstudio');
    expect(store.session()).toBeNull();
    expect(meCalls).toBe(0);
  });

  it('refuses a suspended photographer', async () => {
    const store = TestBed.inject(SessionStore);
    store.set(sessionFor(accounts['priya']));
    accounts['priya'] = { ...accounts['priya'], status: 'suspended' };
    expect(url(await run(roleGuard('photographer')))).toBe('/login?returnUrl=%2Fstudio');
    expect(store.session()).toBeNull();
  });

  it('reuses a successful check for a few minutes instead of calling the backend on every navigation', async () => {
    TestBed.inject(SessionStore).set(sessionFor(accounts['priya']));
    await run(roleGuard('photographer')); await run(roleGuard('photographer'));
    expect(meCalls).toBe(1);
  });

  it('ignores malformed session data in localStorage', () => {
    localStorage.setItem('lenscape.session', JSON.stringify({ role: 'photographer' }));
    expect(TestBed.inject(SessionStore).session()).toBeNull();
    expect(localStorage.getItem('lenscape.session')).toBeNull();
  });

  it('keeps signed-in users away from guest-only pages', () => {
    TestBed.inject(SessionStore).set(sessionFor(accounts['carla']));
    const r = TestBed.runInInjectionContext(() => (guestGuard as (...a: unknown[]) => unknown)({}, {})) as UrlTree;
    expect(url(r)).toBe('/account');
  });
});
