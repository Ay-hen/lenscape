import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface TabItem { id: string; label: string; count?: number }
@Component({
  selector: 'app-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="t" role="tablist" [attr.aria-label]="label()">@for (t of tabs(); track t.id) { <button type="button" role="tab" [attr.aria-selected]="t.id === active()" [class.on]="t.id === active()" (click)="changed.emit(t.id)">{{ t.label }}@if (t.count != null) { <span class="n">{{ t.count }}</span> }</button> }</div>`,
  styles: `.t { display: flex; gap: 4px; border-bottom: 1px solid var(--c-border); overflow-x: auto; scrollbar-width: none; } button { background: none; border: 0; padding: 12px 14px; font-size: 14px; font-weight: 600; color: var(--c-text-muted); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; white-space: nowrap; display: inline-flex; gap: 6px; align-items: center; }
  button:hover { color: var(--c-ink); } .on { color: var(--c-primary-text); border-color: var(--c-primary-600); } .n { background: var(--c-surface-2); border-radius: 999px; font-size: 11px; padding: 1px 8px; color: var(--c-text-muted); }`,
})
export class TabsComponent { readonly tabs = input.required<TabItem[]>(); readonly active = input.required<string>(); readonly label = input('Sections'); readonly changed = output<string>(); }
