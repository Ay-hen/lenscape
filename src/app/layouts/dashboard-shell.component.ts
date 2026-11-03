import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { RealtimeService } from '../core/realtime/realtime.service';
import { AuthService } from '../core/auth/auth.service';
import { MessagingRepository } from '../core/api/repositories';
import { NotificationsStore } from '../core/state/stores';
import { SessionStore } from '../core/auth/session.store';
import { IconComponent } from '../shared/ui/icon.component';
import { HeaderActionsComponent } from './header-actions.component';
import { LogoComponent } from './logo.component';
import { AREAS, NavArea } from './nav.config';

/** One responsive shell for the customer, photographer and admin areas; the nav comes from route data. */
@Component({
  selector: 'app-dashboard-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, HeaderActionsComponent, LogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <a class="skip-link" [routerLink]="[]" queryParamsHandling="preserve" fragment="main">Skip to content</a>
  <div class="app" [class.admin]="areaKey() === 'admin'" [class.studio-theme]="areaKey() === 'studio'">
    <aside class="sb" [class.open]="open()" aria-label="Section navigation">
      <div class="brand"><app-logo [light]="true" /></div>
      <div class="area">{{ area().title }}</div>
      <nav>
        @for (g of area().groups; track g.heading) {
          <div class="gh">{{ g.heading }}</div>
          @for (i of g.items; track i.link) {
            <a [routerLink]="i.link" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: !!i.exact }" (click)="open.set(false)"><app-icon [name]="i.icon" [size]="18" /><span>{{ i.label }}</span>
              @if (i.badge === 'notifications' && notes.unread()) { <b>{{ notes.unread() }}</b> } @if (i.badge === 'messages' && unreadMsgs()) { <b>{{ unreadMsgs() }}</b> }</a>
          }
        }
      </nav>
      <div class="side-foot"><a routerLink="/" class="back"><app-icon name="arrow-left" [size]="16" />Back to marketplace</a></div>
    </aside>
    @if (open()) { <button class="scrim" type="button" aria-label="Close menu" (click)="open.set(false)"></button> }
    <div class="col">
      <header class="top"><button type="button" class="burger" aria-label="Open menu" (click)="open.set(true)"><app-icon name="menu" [size]="22" /></button><div class="grow"></div>
       <app-header-actions /></header>
      <main id="main"><router-outlet /></main>
    </div>
  </div>`,
  styles: `.app { display: grid; grid-template-columns: var(--sidebar-w) minmax(0, 1fr); min-height: 100vh; background: var(--c-bg); } .col { min-width: 0; display: flex; flex-direction: column; }
  .sb { background: var(--c-chrome); color: var(--c-chrome-text); display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; overflow-y: auto; padding: 18px 12px; } .admin .sb { background: #0d1b3d; }
  .brand { padding: 4px 8px 16px; } .area { margin: 0 8px 12px; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--c-chrome-muted); }
  .gh { margin: 14px 10px 6px; font-size: 11px; color: var(--c-chrome-muted); text-transform: uppercase; letter-spacing: .08em; }
  nav a { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 10px; color: var(--c-chrome-text); font-size: 14px; font-weight: 500; text-decoration: none; } nav a:hover { background: rgb(255 255 255 / 7%); color: #fff; } nav a.on { background: var(--c-primary-600); color: #fff; }
  nav a b { margin-left: auto; background: var(--c-primary-600); color: #fff; font-size: 11px; min-width: 20px; height: 20px; border-radius: 10px; display: grid; place-items: center; padding: 0 5px; } nav a.on b { background: #fff; color: var(--c-primary-700); }
  .side-foot { margin-top: auto; padding-top: 16px; } .back { display: flex; gap: 8px; align-items: center; font-size: 13px; color: var(--c-chrome-muted); padding: 8px 10px; text-decoration: none; } .back:hover { color: #fff; }
  .top { position: sticky; top: 0; z-index: 30; height: var(--header-h); display: flex; align-items: center; gap: 12px; padding: 0 24px; background: var(--c-bg-glass); backdrop-filter: blur(8px); border-bottom: 1px solid var(--c-border); }
  main { padding: 28px 24px 64px; max-width: 1280px; width: 100%; margin: 0 auto; }
  .burger { display: none; background: none; border: 0; padding: 6px; cursor: pointer; } .scrim { display: none; }
  @media (max-width: 900px) { .app { grid-template-columns: minmax(0, 1fr); } .sb { position: fixed; z-index: 80; inset: 0 auto 0 0; width: 280px; transform: translateX(-100%); transition: transform .25s var(--ease); } .sb.open { transform: none; } .burger { display: block; } .scrim { display: block; position: fixed; inset: 0; z-index: 70; background: rgb(0 0 0 / 50%); border: 0; } .top { padding: 0 14px; } main { padding: 20px 14px 56px; } }`,
})
export class DashboardShellComponent {
  private route = inject(ActivatedRoute); private router = inject(Router);
  readonly session = inject(SessionStore); readonly notes = inject(NotificationsStore); private msgs = inject(MessagingRepository); private auth = inject(AuthService); private rt = inject(RealtimeService);
  readonly open = signal(false);
  readonly areaKey = computed(() => this.route.snapshot.data['area'] as keyof typeof AREAS);
  readonly area = computed<NavArea>(() => AREAS[this.areaKey()]);
  readonly unreadMsgs = signal(0);
  constructor() {
    const refresh = () => { if (this.auth.role() !== 'admin') this.msgs.conversations().subscribe(c => this.unreadMsgs.set(c.reduce((s, x) => s + (x.unreadFor[this.session.user()?.id ?? ''] ?? 0), 0))); };
    refresh();
    this.rt.chat$.subscribe(e => { if (e.type === 'message' || e.type === 'read') refresh(); });
    toSignal(this.router.events.pipe(filter(e => e instanceof NavigationEnd)));
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(refresh);
  }
}