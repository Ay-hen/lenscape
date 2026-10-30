import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router, UrlTree } from '@angular/router';
import { Observable, map } from 'rxjs';
import { Role } from '../models';
import { AuthService, HOME_BY_ROLE } from './auth.service';
import { SessionStore } from './session.store';

/**
 * Role guard. Anonymous visitors, forged or expired sessions and accounts that the backend does not confirm are sent to /login;
 * a genuine user of another role is sent to their own home (a customer typing /studio lands on /account).
 * The check is async on purpose: AuthService.verify() re-reads the account from the backend instead of trusting localStorage,
 * and the role used here is the backend's. This is a UX layer ONLY — the backend MUST authorise every API call independently
 * (Spring Security + @PreAuthorize / method security).
 */
export const roleGuard = (...roles: Role[]): CanActivateFn & CanMatchFn => (_route, segmentsOrState): Observable<boolean | UrlTree> => {
  const auth = inject(AuthService); const router = inject(Router);
  const url = typeof segmentsOrState === 'object' && 'url' in segmentsOrState ? (segmentsOrState as { url: string }).url : '/';
  return auth.verify().pipe(map(s => {
    if (!s) return router.createUrlTree(['/login'], { queryParams: { returnUrl: url } });
    return roles.includes(s.role) ? true : router.createUrlTree([HOME_BY_ROLE[s.role]]);
  }));
};

/** Keeps signed-in users away from login/register screens. */
export const guestGuard: CanActivateFn = () => {
  const s = inject(SessionStore).session(); const router = inject(Router);
  return s ? router.createUrlTree([HOME_BY_ROLE[s.role]]) : true;
};
