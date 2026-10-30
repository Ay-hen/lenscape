import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { FavoritesStore, NotificationsStore } from '../core/state/stores';
import { timeAgo } from '../core/util/dates';
import { AvatarComponent } from '../shared/ui/misc';
import { IconComponent } from '../shared/ui/icon.component';
import { metaOf } from '../shared/notifications/notification-meta';
import { ThemeToggleComponent } from './theme-toggle.component';

/** Notification bell + user menu, shared by the public header and every dashboard top bar. */
@Component({
  selector: 'app-header-actions',
  imports: [RouterLink, IconComponent, AvatarComponent, ThemeToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <app-theme-toggle />
  @if (auth.user(); as u) {
    <div class="wrap">
      <button type="button" class="ib" [class.ring]="notes.unread() > 0" aria-label="Notifications" [attr.aria-expanded]="open() === 'n'" aria-haspopup="true" (click)="toggle('n')">
        <app-icon name="bell" />@if (notes.unread() > 0) { <span class="dot" aria-hidden="true">{{ notes.unread() > 9 ? '9+' : notes.unread() }}</span><span class="sr-only">{{ notes.unread() }} unread</span> }
      </button>
      @if (open() === 'n') {
        <div class="pop pop--notes fade-in" role="menu">
          <div class="ph"><div><strong>Notifications</strong>@if (notes.unread()) { <span class="cnt">{{ notes.unread() }} new</span> }</div>@if (notes.unread()) { <button class="link-btn small" type="button" (click)="notes.markRead('all')">Mark all read</button> }</div>
          <div class="list">
            @for (n of notes.items().slice(0, 6); track n.id) {
              <a class="ni" [class.un]="!n.read" [routerLink]="n.link || null" (click)="notes.markRead(n.id); open.set(null)" role="menuitem">
                <span class="tile" [attr.data-tone]="meta(n.type).tone"><app-icon [name]="meta(n.type).icon" [size]="18" /></span>
                <span class="tx"><span class="t1"><strong>{{ n.title }}</strong><em>{{ ago(n.createdAt) }}</em></span><span class="t2">{{ n.body }}</span></span>
                @if (!n.read) { <i class="pip" aria-hidden="true"></i> }
              </a>
            } @empty { <div class="empty"><span class="ring2"><app-icon name="bell" [size]="22" /></span><strong>All caught up</strong><span class="muted small">New activity will appear here.</span></div> }
          </div>
          <a class="all" [routerLink]="notificationsLink()" (click)="open.set(null)">View all notifications<app-icon name="arrow-right" [size]="15" /></a></div>
      }
    </div>
    <div class="wrap">
      <button type="button" class="um" [attr.aria-expanded]="open() === 'u'" aria-haspopup="true" (click)="toggle('u')"><app-avatar [src]="u.avatarUrl || ''" [name]="u.name" [size]="34" /><span class="nm">{{ first() }}</span><app-icon name="chevron-down" [size]="14" /></button>
      @if (open() === 'u') {
        <div class="pop pop--sm fade-in" role="menu"><div class="ph col"><strong>{{ u.name }}</strong><span class="muted small">{{ roleLabel() }}</span></div>
          <a role="menuitem" [routerLink]="auth.homeFor(auth.role())" (click)="open.set(null)"><app-icon name="layout-dashboard" [size]="16" />Dashboard</a>
          @if (auth.role() !== 'admin') { <a role="menuitem" [routerLink]="profileLink()" (click)="open.set(null)"><app-icon name="user" [size]="16" />My profile</a> }
          @if (auth.role() === 'client') { <a role="menuitem" routerLink="/account/favorites" (click)="open.set(null)"><app-icon name="heart" [size]="16" />Favourites ({{ favs.count() }})</a> }
          <button role="menuitem" type="button" (click)="logout()"><app-icon name="log-out" [size]="16" />Sign out</button></div>
      }
    </div>
  } @else {
    <a class="btn btn--ghost" routerLink="/login">Sign in</a><a class="btn btn--primary join" routerLink="/register">Join free</a>
  }`,
  styles: `:host { display: flex; align-items: center; gap: 8px; } @media (max-width: 440px) { .join { display: none; } } .wrap { position: relative; }
  .ib { position: relative; width: 40px; height: 40px; border-radius: 50%; border: 0; background: transparent; cursor: pointer; display: grid; place-items: center; color: var(--c-text); } .ib:hover { background: var(--c-surface-2); }
  .dot { position: absolute; top: 2px; right: 0; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 9px; background: var(--c-primary-600); color: #fff; font-size: 11px; font-weight: 700; display: grid; place-items: center; }
  .um { display: flex; align-items: center; gap: 8px; border: 1px solid var(--c-border); background: var(--c-surface); border-radius: 999px; padding: 3px 10px 3px 3px; cursor: pointer; } .um:hover { background: var(--c-surface-2); } .nm { font-size: 14px; font-weight: 600; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  @media (max-width: 640px) { .nm { display: none; } }
  .pop { position: absolute; right: 0; top: calc(100% + 8px); width: min(92vw, 360px); background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 14px; box-shadow: var(--shadow-3); z-index: 60; overflow: hidden; } .pop--sm { width: 230px; }
  .ph { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-bottom: 1px solid var(--c-border); } .ph.col { flex-direction: column; align-items: flex-start; } .cnt { margin-left: 8px; font-size: 11px; font-weight: 700; color: var(--c-primary-text); background: var(--c-primary-50); padding: 2px 8px; border-radius: 999px; }
  .pop a, .pop button[role=menuitem] { display: flex; gap: 10px; align-items: center; padding: 10px 14px; width: 100%; background: none; border: 0; text-align: left; color: var(--c-text); font-size: 14px; cursor: pointer; text-decoration: none; } .pop a:hover, .pop button[role=menuitem]:hover { background: var(--c-surface-2); }
  .pop--notes { width: min(94vw, 400px); border-radius: 18px; box-shadow: 0 18px 50px rgb(15 23 42 / 22%); transform-origin: top right; animation: pop .16s ease-out; } .list { max-height: min(60vh, 420px); overflow-y: auto; padding: 6px; }
  .pop a.ni { display: flex; align-items: flex-start; gap: 12px; padding: 10px; border-radius: 12px; position: relative; } .ni.un { background: var(--c-primary-50); } .ni:hover { background: var(--c-surface-2) !important; }
  .tile { width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; flex: none; background: var(--c-surface-2); color: var(--c-text-muted); }
  .tile[data-tone='blue'] { background: var(--c-primary-100); color: var(--c-primary-700); } .tile[data-tone='teal'] { background: var(--c-secondary-50); color: var(--c-secondary-500); } .tile[data-tone='amber'] { background: var(--c-accent-soft); color: var(--c-accent-ink); } .tile[data-tone='green'] { background: var(--c-success-bg); color: var(--c-success); } .tile[data-tone='slate'] { background: var(--c-info-bg); color: var(--c-info); }
  .tx { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; } .t1 { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; } .t1 strong { font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .t1 em { font-size: 11px; color: var(--c-text-subtle); font-style: normal; white-space: nowrap; }
  .t2 { color: var(--c-text-muted); font-size: 13px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; } .pip { width: 8px; height: 8px; border-radius: 50%; background: var(--c-primary-600); margin-top: 6px; flex: none; }
  .all { justify-content: center; font-weight: 600; color: var(--c-primary-text) !important; border-top: 1px solid var(--c-border); padding: 13px 14px !important; gap: 6px !important; }
  .empty { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 30px 16px; text-align: center; } .ring2 { width: 52px; height: 52px; border-radius: 50%; background: var(--c-primary-50); color: var(--c-primary-600); display: grid; place-items: center; margin-bottom: 6px; }
  .ib.ring app-icon { animation: ring 2.4s ease-in-out 1; transform-origin: 50% 0; display: inline-flex; } @keyframes ring { 0%, 100% { transform: rotate(0); } 10% { transform: rotate(14deg); } 20% { transform: rotate(-12deg); } 30% { transform: rotate(8deg); } 40% { transform: rotate(-6deg); } 50% { transform: rotate(0); } }
  @keyframes pop { from { opacity: 0; transform: translateY(-6px) scale(.98); } to { opacity: 1; transform: none; } } @media (prefers-reduced-motion: reduce) { .pop--notes, .ib.ring app-icon { animation: none; } }
`,
})
export class HeaderActionsComponent {
  readonly auth = inject(AuthService); readonly notes = inject(NotificationsStore); readonly favs = inject(FavoritesStore);
  private router = inject(Router); private host = inject(ElementRef);
  readonly open = signal<'n' | 'u' | null>(null);
  readonly first = computed(() => this.auth.user()?.name.split(' ')[0] ?? '');
  readonly roleLabel = computed(() => ({ client: 'Customer', photographer: 'Photographer', admin: 'Administrator' } as const)[this.auth.role() ?? 'client']);
  readonly profileLink = computed(() => (this.auth.role() === 'photographer' ? '/studio/profile' : '/account/settings'));
  readonly notificationsLink = computed(() => { const r = this.auth.role(); return r === 'photographer' ? '/studio/notifications' : r === 'admin' ? '/admin' : '/account/notifications'; });
  toggle(k: 'n' | 'u') { this.open.update(v => (v === k ? null : k)); }
  ago = (iso: string) => timeAgo(iso); readonly meta = metaOf;
  logout() { this.open.set(null); this.auth.logout(); }
  @HostListener('document:click', ['$event']) outside(e: Event) { if (!this.host.nativeElement.contains(e.target)) this.open.set(null); }
  @HostListener('document:keydown.escape') esc() { this.open.set(null); }
  void_ = this.router;
}
