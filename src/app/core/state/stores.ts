import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FavoriteRepository, NotificationRepository } from '../api/repositories';
import { SessionStore } from '../auth/session.store';
import { AppNotification, NotificationType, PhotographerSummary } from '../models';
import { RealtimeService } from '../realtime/realtime.service';
import { ToastService } from '../../shared/services/overlay.services';

@Injectable({ providedIn: 'root' })
export class FavoritesStore {
  private repo = inject(FavoriteRepository); private session = inject(SessionStore); private router = inject(Router); private toast = inject(ToastService);
  readonly ids = signal<string[]>([]);
  readonly count = computed(() => this.ids().length);
  constructor() {
    effect(() => { if (this.session.role() === 'client') this.repo.list().subscribe(v => this.ids.set(v)); else this.ids.set([]); });
  }
  has(id: string) { return this.ids().includes(id); }
  toggle(id: string) {
    if (this.session.role() !== 'client') { this.toast.info('Sign in with a customer account to save favourites.'); void this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } }); return; }
    const prev = this.ids(); this.ids.set(prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); // optimistic
    this.repo.toggle(id).subscribe({ next: v => this.ids.set(v), error: () => { this.ids.set(prev); this.toast.error('Could not update favourites.'); } });
  }
}

@Injectable({ providedIn: 'root' })
export class NotificationsStore {
  private repo = inject(NotificationRepository); private session = inject(SessionStore); private rt = inject(RealtimeService); private toast = inject(ToastService);
  readonly items = signal<AppNotification[]>([]);
  readonly unread = computed(() => this.items().filter(n => !n.read).length);
  constructor() {
    effect(() => { if (this.session.isAuthenticated()) this.refresh(); else this.items.set([]); });
    // Live push: new notifications appear (and the badge counts up) without a reload. The server re-uses an id when it collapses a conversation's messages into one entry.
    this.rt.notification$.subscribe(n => {
      const item: AppNotification = { ...n, type: n.type.toLowerCase() as NotificationType };
      const isNew = !this.items().some(x => x.id === item.id);
      this.items.update(l => [item, ...l.filter(x => x.id !== item.id)]);
      if (isNew && !item.read) this.toast.info(item.title);
    });
    // Reading a conversation also closes its "new message" notification on the server: re-sync the bell.
    this.rt.chat$.subscribe(e => { if (e.type === 'read' && e.actor && e.actor === this.session.user()?.id) this.refresh(); });
  }
  refresh() { this.repo.list().subscribe({ next: v => this.items.set(v), error: () => undefined }); }
  remove(id: string) { this.items.update(l => l.filter(n => n.id !== id)); this.repo.remove(id).subscribe({ error: () => this.refresh() }); }
  clear(scope: 'all' | 'read' = 'all') { this.items.update(l => (scope === 'all' ? [] : l.filter(n => !n.read))); this.repo.clear(scope).subscribe({ error: () => this.refresh() }); }
  markRead(id: string | 'all') { this.items.update(l => l.map(n => (id === 'all' || n.id === id ? { ...n, read: true } : n))); this.repo.markRead(id).subscribe(); }
}

/** Up to 3 photographers for side-by-side comparison. */
@Injectable({ providedIn: 'root' })
export class CompareStore {
  readonly items = signal<PhotographerSummary[]>([]);
  has(id: string) { return this.items().some(p => p.id === id); }
  toggle(p: PhotographerSummary): boolean {
    if (this.has(p.id)) { this.items.update(l => l.filter(x => x.id !== p.id)); return true; }
    if (this.items().length >= 3) return false; this.items.update(l => [...l, p]); return true;
  }
  clear() { this.items.set([]); }
}

@Injectable({ providedIn: 'root' })
export class RecentlyViewedStore {
  private key = 'lenscape.recent';
  readonly ids = signal<string[]>(this.read());
  add(id: string) { const next = [id, ...this.ids().filter(x => x !== id)].slice(0, 8); this.ids.set(next); try { localStorage.setItem(this.key, JSON.stringify(next)); } catch { /* ignore */ } }
  private read(): string[] { try { return JSON.parse(localStorage.getItem(this.key) ?? '[]'); } catch { return []; } }
}

@Injectable({ providedIn: 'root' })
export class SavedSearchStore {
  private key = 'lenscape.savedSearches';
  readonly items = signal<{ id: string; label: string; query: Record<string, string> }[]>(this.read());
  add(label: string, query: Record<string, string>) { const next = [{ id: String(Date.now()), label, query }, ...this.items()].slice(0, 6); this.set(next); }
  remove(id: string) { this.set(this.items().filter(s => s.id !== id)); }
  private set(v: typeof this.items extends () => infer R ? R : never) { this.items.set(v); try { localStorage.setItem(this.key, JSON.stringify(v)); } catch { /* ignore */ } }
  private read() { try { return JSON.parse(localStorage.getItem(this.key) ?? '[]'); } catch { return []; } }
}