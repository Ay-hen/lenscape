import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { APP_ENV } from '../config/app-config';
import { ApiError, ApiErrorCode } from '../models';
import { SessionStore } from './session.store';

/** Adds the bearer token ONLY to requests going to our own API (never to third-party hosts such as geocoders). */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const env = inject(APP_ENV); const token = inject(SessionStore).token();
  if (token && req.url.startsWith(env.apiBaseUrl)) return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
  return next(req);
};

const codeFor = (s: number): ApiErrorCode => s === 0 ? 'NETWORK' : s === 400 || s === 422 ? 'VALIDATION' : s === 401 ? 'UNAUTHENTICATED' : s === 403 ? 'FORBIDDEN' : s === 404 ? 'NOT_FOUND' : s === 409 ? 'CONFLICT' : s >= 500 ? 'SERVER' : 'UNKNOWN';

/** Normalises every HTTP failure into an ApiError so UI code handles ONE error shape. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionStore); const router = inject(Router); const env = inject(APP_ENV);
  return next(req).pipe(catchError((e: unknown) => {
    if (!(e instanceof HttpErrorResponse) || !req.url.startsWith(env.apiBaseUrl)) return throwError(() => e);
    if (e.status === 401 && session.isAuthenticated()) { session.set(null); void router.navigate(['/login'], { queryParams: { expired: 1 } }); }
    const body = e.error as { message?: string; code?: ApiErrorCode; errors?: Record<string, string>; retryAfterSeconds?: number } | null;
    const msg = e.status === 0 ? 'Cannot reach the server. Check your connection and try again.' : body?.message ?? e.statusText ?? 'Something went wrong.';
    return throwError(() => new ApiError(body?.code ?? codeFor(e.status), msg, e.status, body?.errors, body?.retryAfterSeconds));
  }));
};
