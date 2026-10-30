import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ICONS } from './icons';

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg xmlns="http://www.w3.org/2000/svg" [attr.width]="size()" [attr.height]="size()" viewBox="0 0 24 24" fill="none" stroke="currentColor" [attr.stroke-width]="stroke()" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" [innerHTML]="html()"></svg>`,
  styles: `:host { display: inline-flex; flex: none; line-height: 0; } svg { display: block; }`,
  host: { 'aria-hidden': 'true' },
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly size = input(18);
  readonly stroke = input(2);
  private san = inject(DomSanitizer);
  // Icon data is a compile-time constant from the lucide package (never user input), so trusting it is safe.
  readonly html = computed<SafeHtml>(() => {
    const node = ICONS[this.name()] ?? ICONS['info'];
    const s = node.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('');
    return this.san.bypassSecurityTrustHtml(s);
  });
}
