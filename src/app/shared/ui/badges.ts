import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent } from './icon.component';
import { PackageTier } from '../../core/models';

export type Tone = 'neutral' | 'success' | 'warning' | 'error' | 'info' | 'brand';

const STATUS_TONE: Record<string, Tone> = {
  pending: 'warning', confirmed: 'success', completed: 'info', cancelled: 'neutral', rejected: 'error', expired: 'neutral',
  approved: 'success', needs_info: 'warning', draft: 'neutral', published: 'success', archived: 'neutral', active: 'success', suspended: 'error',
  paid: 'success', unpaid: 'neutral', refunded: 'info', partially_refunded: 'info', open: 'warning', resolved: 'success', hidden: 'error', reported: 'warning', ok: 'success',
  dismissed: 'neutral', actioned: 'success', delivered: 'success', editing: 'info', not_started: 'neutral',
};
const LABEL: Record<string, string> = { needs_info: 'Needs info', partially_refunded: 'Partly refunded', not_started: 'Not started', ok: 'Visible' };

@Component({
  selector: 'app-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="b" [class]="'b--' + toneResolved()"><ng-content>{{ text() }}</ng-content></span>`,
  styles: `.b { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; text-transform: capitalize; }
  .b--neutral { background: var(--c-surface-2); color: var(--c-text-muted); } .b--success { background: var(--c-success-bg); color: var(--c-success); }
  .b--warning { background: var(--c-warning-bg); color: var(--c-warning); } .b--error { background: var(--c-error-bg); color: var(--c-error); }
  .b--info { background: var(--c-info-bg); color: var(--c-info); } .b--brand { background: var(--c-primary-50); color: var(--c-primary-text); }`,
})
export class BadgeComponent {
  readonly status = input<string>('');
  readonly tone = input<Tone | null>(null);
  readonly toneResolved = computed(() => this.tone() ?? STATUS_TONE[this.status()] ?? 'neutral');
  readonly text = computed(() => LABEL[this.status()] ?? this.status().replace(/_/g, ' '));
}

@Component({
  selector: 'app-tier-badge',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="t" [class]="'t--' + tier()"><app-icon name="award" [size]="13" />{{ tier() }}</span>`,
  styles: `.t { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 700; text-transform: capitalize; border: 1px solid; letter-spacing: .02em; }
  .t--bronze { color: var(--tier-bronze-fg); background: var(--tier-bronze-bg); border-color: var(--tier-bronze-border); }
  .t--silver { color: var(--tier-silver-fg); background: var(--tier-silver-bg); border-color: var(--tier-silver-border); }
  .t--gold { color: var(--tier-gold-fg); background: var(--tier-gold-bg); border-color: var(--tier-gold-border); }
  .t--platinum { color: var(--tier-platinum-fg); background: var(--tier-platinum-bg); border-color: var(--tier-platinum-border); }`,
})
export class TierBadgeComponent { readonly tier = input.required<PackageTier>(); }
