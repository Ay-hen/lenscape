import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { AuthRepository } from '../api/repositories';
import { LoginRequest, RegisterCustomerRequest, RegisterPhotographerRequest, Role, Session, User, RegistrationStarted } from '../models';
import { isExpired } from './jwt';
import { SessionStore, isRole } from './session.store';

export const HOME_BY_ROLE: Record<Role, string> = { client: '/account', photographer: '/studio', admin: '/admin' };

/** How long a successful verification is reused before the account is re-read from the backend. */
const VERIFY_TTL_MS = 5 * 60_000;

/** All authentication logic lives here — pages only call these methods. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private repo = inject(AuthRepository);
  private store = inject(SessionStore);
  private router = inject(Router);
  private verified: { key: string; at: number } | null = null;

  readonly user = this.store.user;
  readonly role = this.store.role;
  readonly isAuthenticated = this.store.isAuthenticated;
  readonly session = this.store.session;

  login(req: LoginRequest): Observable<Session> { return this.repo.login(req).pipe(tap(s => this.accept(s))); }
  /** Registration only starts e-mail verification: the user is NOT signed in until verifyEmail() succeeds. */
  registerCustomer(req: RegisterCustomerRequest): Observable<RegistrationStarted> { return this.repo.registerCustomer(req); }
  registerPhotographer(req: RegisterPhotographerRequest): Observable<RegistrationStarted> { return this.repo.registerPhotographer(req); }
  verifyEmail(email: string, otp: string): Observable<Session> { return this.repo.verifyEmail(email, otp).pipe(tap(s => this.accept(s))); }
  resendCode(email: string): Observable<void> { return this.repo.resendCode(email); }
  logout(): void {
    const token = this.store.session()?.token;
    this.verified = null;
    this.store.set(null);
    if (token) this.repo.logout(token).subscribe({ error: () => undefined }); // revokes the token on the server; local sign-out never depends on it
    void this.router.navigateByUrl('/');
  }
  homeFor(role: Role | null): string { return role ? HOME_BY_ROLE[role] : '/login'; }
  hasRole(...roles: Role[]): boolean { const r = this.store.role(); return !!r && roles.includes(r); }

  /**
   * Confirms the stored session is genuine before a role-protected area opens (used by roleGuard).
   * The session lives in localStorage, which anyone can edit, so it is never trusted on its own:
   *  - the session must hold an unexpired token;
   *  - the account is re-read from the backend (`AuthRepository.me`) and the ROLE COMES FROM THAT ANSWER, not from storage;
   *  - suspended accounts are refused.
   * Emits the (possibly corrected) session, or null after clearing it. Successful checks are reused for 5 minutes.
   * This is still a UX layer: the backend must authorise every API call independently.
   */
  verify(): Observable<Session | null> {
    const s = this.store.session();
    if (!s) return of(null);
    if (isExpired(s.token)) return of(this.drop());
    if (this.verified && this.verified.key === this.keyOf(s) && Date.now() - this.verified.at < VERIFY_TTL_MS) return of(s);
    return this.repo.me().pipe(
      map(u => this.reconcile(s, u)),
      catchError(() => of(this.drop())),
    );
  }

  private reconcile(s: Session, u: User): Session | null {
    if (u.id !== s.user.id) return this.drop(); // the token belongs to a different account than the stored session claims
    if (u.status === 'suspended') return this.drop();
    // The backend's answer wins over whatever localStorage claims.
    const role = isRole(u.role) ? u.role : s.role;
    const next: Session = role === s.role ? s : { ...s, role, user: { ...s.user, role } };
    if (next !== s) this.store.set(next);
    this.verified = { key: this.keyOf(next), at: Date.now() };
    return next;
  }

  private accept(s: Session): void { this.store.set(s); this.verified = { key: this.keyOf(s), at: Date.now() }; }
  private keyOf(s: Session): string { return `${s.user.id}|${s.role}|${s.token}`; }
  private drop(): null { this.verified = null; this.store.set(null); return null; }
}
