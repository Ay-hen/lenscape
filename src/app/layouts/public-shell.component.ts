import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CatalogRepository } from '../core/api/repositories';
import { SessionStore } from '../core/auth/session.store';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { HeaderActionsComponent } from './header-actions.component';
import { LogoComponent } from './logo.component';
import { IconComponent } from '../shared/ui/icon.component';

@Component({
  selector: 'app-public-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, HeaderActionsComponent, LogoComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <a class="skip-link" [routerLink]="[]" queryParamsHandling="preserve" fragment="main">Skip to content</a>
  @if (banner.value()) { <div class="bn" role="status"><div class="container wide">{{ banner.value() }}</div></div> }
  <header class="hd"><div class="container wide"><app-logo />
    <nav class="nav" [class.open]="menu()" aria-label="Main">
      <a routerLink="/discover" routerLinkActive="on" (click)="menu.set(false)">Find photographers</a>
      <a routerLink="/discover" [queryParams]="{ view: 'map' }" (click)="menu.set(false)">Map</a>
      <a routerLink="/" fragment="how" (click)="menu.set(false)">How it works</a>
      <a routerLink="/register/photographer" routerLinkActive="on" (click)="menu.set(false)">For photographers</a>
      @if (!session.isAuthenticated()) { <a routerLink="/register" class="m-only" (click)="menu.set(false)">Create a free account</a> }
    </nav>
    <div class="grow"></div><app-header-actions />
    <button type="button" class="burger" [attr.aria-expanded]="menu()" aria-label="Menu" (click)="menu.set(!menu())"><app-icon [name]="menu() ? 'x' : 'menu'" [size]="22" /></button>
  </div></header>
  <main id="main"><router-outlet /></main>
  <footer class="ft"><div class="container">
    <div class="cols"><div><app-logo [light]="true" /><p>Find, compare and book trusted photographers near you — weddings, portraits, events and more.</p></div>
      <div><h4>Explore</h4><a routerLink="/discover">All photographers</a><a routerLink="/discover" [queryParams]="{ view: 'map' }">Browse the map</a><a routerLink="/discover" [queryParams]="{ category: 'wedding' }">Weddings</a><a routerLink="/discover" [queryParams]="{ category: 'portrait' }">Portraits</a></div>
      <div><h4>Photographers</h4><a routerLink="/register/photographer">Join as a photographer</a><a routerLink="/login">Studio sign in</a></div>
      <div><h4>Trust & safety</h4><a routerLink="/" fragment="trust">How we vet profiles</a><a routerLink="/" fragment="faq">FAQ</a><span>Map data © OpenStreetMap contributors</span></div></div>
    <div class="legal"><span>© {{ year }} Lenscape</span></div></div></footer>`,
  styles: `.m-only { display: none; } @media (max-width: 900px) { .m-only { display: block; } .hd .container { gap: 10px; } } .bn { background: var(--c-chrome); color: #fff; font-size: 13px; padding: 8px 0; text-align: center; } .hd { position: sticky; top: 0; z-index: 50; background: var(--c-bg-glass); backdrop-filter: blur(10px); border-bottom: 1px solid var(--c-border); }
  .hd .container { display: flex; align-items: center; gap: 24px; height: var(--header-h); } .container.wide { max-width: var(--container-wide); }
  .nav { display: flex; gap: 4px; } .nav a { padding: 8px 12px; border-radius: 8px; font-size: 14px; font-weight: 500; color: var(--c-text); text-decoration: none; } .nav a:hover, .nav a.on { background: var(--c-surface-2); }
  .burger { display: none; background: none; border: 0; cursor: pointer; padding: 6px; border-radius: 8px; }
  @media (max-width: 900px) { .burger { display: block; } .nav { position: fixed; inset: var(--header-h) 0 auto 0; background: var(--c-surface); flex-direction: column; padding: 12px 16px; border-bottom: 1px solid var(--c-border); box-shadow: var(--shadow-3); display: none; } .nav.open { display: flex; } .nav a { padding: 12px; } }
  main { min-height: 70vh; } .ft { background: var(--c-chrome); color: var(--c-chrome-text); margin-top: 80px; padding: 56px 0 28px; } .cols { display: grid; gap: 32px; grid-template-columns: 1.5fr 1fr 1fr 1fr; } @media (max-width: 800px) { .cols { grid-template-columns: 1fr 1fr; } }
  .ft p { margin-top: 12px; font-size: 14px; max-width: 34ch; } .ft h4 { color: #fff; font-family: var(--font-body); font-size: 13px; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 12px; } .ft a, .ft span { display: block; color: var(--c-chrome-text); font-size: 14px; padding: 4px 0; } .ft a:hover { color: #fff; }
  .legal { border-top: 1px solid var(--c-chrome-line); margin-top: 36px; padding-top: 18px; font-size: 13px; color: var(--c-chrome-muted); }`,
})
export class PublicShellComponent { readonly menu = signal(false); readonly year = new Date().getFullYear(); private catalog = inject(CatalogRepository); readonly session = inject(SessionStore); readonly banner = rxResource({ stream: () => this.catalog.siteBanner() }); }
