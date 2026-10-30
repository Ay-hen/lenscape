import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const KEY = 'lenscape.theme';
const BROWSER_BAR: Record<Theme, string> = { light: '#2563eb', dark: '#0a0f1c' };

/**
 * Light/dark theme. The theme is just `<html data-theme="light|dark">`; every colour comes from CSS tokens
 * (see styles/_tokens.scss), so components never branch on it.
 * The inline script in index.html sets the attribute before first paint; this service keeps it in sync afterwards.
 * Until the user picks a theme explicitly, the OS preference is followed (live).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);
  private explicit = this.stored() !== null;
  private readonly _theme = signal<Theme>(this.initial());
  readonly theme = this._theme.asReadonly();
  readonly isDark = computed(() => this._theme() === 'dark');

  constructor() {
    this.apply(this._theme());
    this.doc.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', e => {
      if (!this.explicit) this.set(e.matches ? 'dark' : 'light', false);
    });
  }

  toggle(): void { this.set(this.isDark() ? 'light' : 'dark'); }

  set(theme: Theme, remember = true): void {
    this._theme.set(theme);
    this.apply(theme);
    if (remember) {
      this.explicit = true;
      try { localStorage.setItem(KEY, theme); } catch { /* storage unavailable (private mode) — theme still applies for this visit */ }
    }
  }

  private apply(theme: Theme): void {
    this.doc.documentElement.setAttribute('data-theme', theme);
    this.doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', BROWSER_BAR[theme]);
  }

  private stored(): Theme | null {
    try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : null; } catch { return null; }
  }
  private initial(): Theme {
    const fromDom = this.doc.documentElement.getAttribute('data-theme');
    if (fromDom === 'light' || fromDom === 'dark') return fromDom;
    return this.stored() ?? (this.doc.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
}
