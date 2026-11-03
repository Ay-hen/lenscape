import { Injectable, inject } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { createSplashElement } from './splash';

const HOME_MIN_MS = 700;
const FAILSAFE_MS = 6000;

/**
 * The logo splash while moving through the app: after sign-in, after sign-up, and when going Home.
 * Call `show()` right BEFORE navigating; the router tells us when the new page is in place, then the logo zooms away.
 * Going Home from anywhere (logo, "Home" links) triggers it automatically. The very first page load uses the splash from index.html.
 */
@Injectable({ providedIn: 'root' })
export class SplashService {
  private router = inject(Router);
  private el: HTMLElement | null = null;
  private shownAt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private firstNavigationDone = false;

  constructor() {
    this.router.events.subscribe(e => {
      if (e instanceof NavigationStart) {
        const to = e.url.split(/[?#]/)[0];
        const from = this.router.url.split(/[?#]/)[0];
        if (this.firstNavigationDone && to === '/' && from !== '/') this.show(HOME_MIN_MS);
      } else if (e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError) {
        this.firstNavigationDone = true;
        if (this.el) this.hide();
      }
    });
  }

  /** Covers the screen with the logo. It is removed automatically when the next navigation finishes. */
  show(minVisibleMs = 800): void {
    if (typeof document === 'undefined' || this.el || document.getElementById('splash')) return;
    this.minMs = minVisibleMs;
    this.shownAt = performance.now();
    this.el = createSplashElement();
    document.body.appendChild(this.el);
    this.timer = setTimeout(() => this.hide(), FAILSAFE_MS); // never trap the user behind the splash
  }
  private minMs = 800;

  private hide(): void {
    const el = this.el;
    if (!el) return;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.el = null;
    const wait = Math.max(0, this.minMs - (performance.now() - this.shownAt));
    setTimeout(() => {
      el.classList.remove('cover');
      el.classList.add('out');
      const remove = () => el.remove();
      el.addEventListener('transitionend', remove, { once: true });
      setTimeout(remove, 1200);
    }, wait);
  }
}