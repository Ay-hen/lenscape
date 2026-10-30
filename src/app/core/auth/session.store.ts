import { Injectable, computed, signal } from '@angular/core';
import { Role, Session } from '../models';

const KEY = 'lenscape.session';
const ROLES: readonly string[] = ['client', 'photographer', 'admin'];
export const isRole = (r: unknown): r is Role => typeof r === 'string' && ROLES.includes(r);

/**
 * localStorage can be edited by anyone with DevTools, so whatever comes back from it is shape-checked before use.
 * This only rejects malformed/inconsistent data — it cannot prove the session is genuine. That is AuthService.verify().
 */
function isSession(x: unknown): x is Session {
  if (!x || typeof x !== 'object') return false;
  const s = x as Partial<Session>; const u = s.user as Partial<Session['user']> | undefined;
  return typeof s.token === 'string' && s.token.length > 0 && isRole(s.role)
    && !!u && typeof u.id === 'string' && typeof u.username === 'string' && u.role === s.role;
}

/**
 * Holds the current session. IMPORTANT: this is a *usability* layer only.
 * Real authentication/authorization is enforced by the backend on every request.
 * The original app kept the JWT in localStorage; that is preserved here for compatibility, but an
 * httpOnly, SameSite cookie issued by the backend is the safer option (see README → Security notes).
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly _session = signal<Session | null>(this.restore());
  readonly session = this._session.asReadonly();
  readonly user = computed(() => this._session()?.user ?? null);
  readonly role = computed<Role | null>(() => this._session()?.role ?? null);
  readonly isAuthenticated = computed(() => !!this._session());
  readonly token = computed(() => this._session()?.token ?? null);

  set(s: Session | null): void {
    this._session.set(s);
    try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
  }
  patchUser(patch: Partial<Session['user']>): void {
    const s = this._session(); if (s) this.set({ ...s, user: { ...s.user, ...patch } });
  }
  private restore(): Session | null {
    try {
      const raw = localStorage.getItem(KEY); if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (isSession(parsed)) return parsed;
      localStorage.removeItem(KEY); // malformed or tampered entry
      return null;
    } catch { return null; }
  }
}
