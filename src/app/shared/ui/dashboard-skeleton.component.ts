import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Placeholder shown while a dashboard loads (after login or a page reload). It mirrors the real layout - stat cards, chart cards,
 * list cards - so the page does not jump when the data arrives. Uses the global `.skeleton` shimmer (which respects reduced-motion).
 */
@Component({
  selector: 'app-dashboard-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="ds" role="status" aria-busy="true" aria-live="polite">
    <span class="sr-only">Loading your dashboard…</span>
    <div class="stats">@for (s of statSlots(); track s) {
      <div class="stat"><div class="skeleton" style="height: 12px; width: 55%"></div><div class="skeleton" style="height: 28px; width: 40%; margin-top: 14px"></div><div class="skeleton" style="height: 10px; width: 70%; margin-top: 12px"></div></div>
    }</div>
    @if (charts()) {
      <div class="two">@for (c of [1, 2]; track c) {
        <div class="card pad"><div class="skeleton" style="height: 16px; width: 35%"></div><div class="skeleton" style="height: 220px; margin-top: 16px"></div></div>
      }</div>
    }
    @if (lists()) {
      <div class="three">@for (c of listSlots(); track c) {
        <div class="card pad"><div class="skeleton" style="height: 16px; width: 45%"></div>
          @for (r of [1, 2, 3]; track r) { <div class="row"><div class="skeleton" style="height: 36px; width: 36px; border-radius: 50%"></div><div class="grow"><div class="skeleton" style="height: 12px; width: 80%"></div><div class="skeleton" style="height: 10px; width: 55%; margin-top: 8px"></div></div></div> }
        </div>
      }</div>
    }
  </div>`,
  styles: `
    .ds { display: grid; gap: 20px; }
    .stats { display: grid; gap: 16px; grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .stat, .pad { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--r-lg, 14px); padding: 18px; }
    .two { display: grid; gap: 20px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .three { display: grid; gap: 20px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .row { display: flex; align-items: center; gap: 12px; margin-top: 18px; } .grow { flex: 1; min-width: 0; }
    @media (max-width: 1100px) { .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } .three { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 700px) { .two, .three { grid-template-columns: minmax(0, 1fr); } }
    @media (max-width: 420px) { .stats { grid-template-columns: minmax(0, 1fr); } }
  `,
})
export class DashboardSkeletonComponent {
  readonly stats = input(8);
  readonly charts = input(true);
  /** Number of list cards in the bottom row (0 hides the row). */
  readonly listCount = input(3);
  readonly lists = computed(() => this.listCount() > 0);
  readonly statSlots = computed(() => Array.from({ length: this.stats() }, (_, i) => i));
  readonly listSlots = computed(() => Array.from({ length: this.listCount() }, (_, i) => i));
}