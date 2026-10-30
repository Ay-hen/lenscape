import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ThemeService } from '../core/theme.service';
import { IconComponent } from '../shared/ui/icon.component';

/** Sun/moon button used in the public header and every dashboard top bar. */
@Component({
  selector: 'app-theme-toggle',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button type="button" class="tt" (click)="theme.toggle()" [attr.aria-label]="theme.isDark() ? 'Switch to light mode' : 'Switch to dark mode'" [attr.title]="theme.isDark() ? 'Light mode' : 'Dark mode'"><app-icon [name]="theme.isDark() ? 'sun' : 'moon'" [size]="20" /></button>`,
  styles: `.tt { width: 40px; height: 40px; border-radius: 50%; border: 0; background: transparent; cursor: pointer; display: grid; place-items: center; color: var(--c-text); transition: background var(--dur) var(--ease); } .tt:hover { background: var(--c-surface-2); } .tt:focus-visible { outline: none; box-shadow: var(--shadow-focus); }`,
})
export class ThemeToggleComponent { readonly theme = inject(ThemeService); }
