import { HttpClient, HttpParams } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_ENV } from '../config/app-config';

/** Thin wrapper over HttpClient bound to the configured API base URL. Call from a field initialiser (needs the injection context). */
export interface Api {
  get<T>(path: string, params?: HttpParams): Observable<T>;
  post<T>(path: string, body?: unknown): Observable<T>;
  put<T>(path: string, body?: unknown): Observable<T>;
  patch<T>(path: string, body?: unknown): Observable<T>;
  delete<T>(path: string): Observable<T>;
  readonly http: HttpClient;
  url(path: string): string;
}

export function useApi(): Api {
  const http = inject(HttpClient);
  const base = inject(APP_ENV).apiBaseUrl;
  const url = (p: string) => base + p;
  return {
    http, url,
    get: <T>(p: string, params?: HttpParams) => http.get<T>(url(p), { params }),
    post: <T>(p: string, body: unknown = null) => http.post<T>(url(p), body),
    put: <T>(p: string, body: unknown = null) => http.put<T>(url(p), body),
    patch: <T>(p: string, body: unknown = null) => http.patch<T>(url(p), body),
    delete: <T>(p: string) => http.delete<T>(url(p)),
  };
}
