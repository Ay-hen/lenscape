import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-logo',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<a routerLink="/" class="l" aria-label="Lenscape home"><svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#b8401f"/><circle cx="32" cy="32" r="15" fill="none" stroke="#fff" stroke-width="5"/><circle cx="32" cy="32" r="5" fill="#fff"/></svg><span [class.light]="light()">Lenscape</span></a>`,
  styles: `.l { display: inline-flex; align-items: center; gap: 10px; text-decoration: none !important; } span { font-family: var(--font-display); font-size: 1.35rem; font-weight: 700; color: var(--c-ink); letter-spacing: -.02em; } .light { color: #fff; }`,
})
export class LogoComponent { readonly light = input(false); }
