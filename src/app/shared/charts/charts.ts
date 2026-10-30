import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { TimePoint } from '../../core/models';

const PALETTE = ['#2563eb', '#0d9488', '#e0a526', '#7c3aed', '#0891b2', '#64748b'];
const nice = (max: number) => { if (max <= 0) return 1; const p = 10 ** Math.floor(Math.log10(max)); const f = max / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };
const fmt = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'k' : String(Math.round(n));

interface ChartSeries { name: string; points: TimePoint[] }

/** Dependency-free SVG line/area chart. Scales with its container; includes a visually-hidden data table for screen readers. */
@Component({
  selector: 'app-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <figure class="f">
    <svg viewBox="0 0 640 260" role="img" [attr.aria-label]="label()" preserveAspectRatio="xMidYMid meet">
      @for (g of grid(); track g.y) { <line [attr.x1]="m.l" [attr.x2]="640 - m.r" [attr.y1]="g.y" [attr.y2]="g.y" stroke="var(--c-border)" stroke-dasharray="3 4"/><text [attr.x]="m.l - 8" [attr.y]="g.y + 4" text-anchor="end" class="ax">{{ g.label }}</text> }
      @for (s of paths(); track s.name; let i = $index) {
        @if (area() && i === 0) { <path [attr.d]="s.area" [attr.fill]="s.color" opacity=".12"/> }
        <path [attr.d]="s.d" fill="none" [attr.stroke]="s.color" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      }
      @for (x of xs(); track x.label + $index) { <text [attr.x]="x.x" y="248" text-anchor="middle" class="ax">{{ x.label }}</text> }
      @for (s of paths(); track s.name) { @for (p of s.pts; track $index) { <circle [attr.cx]="p.x" [attr.cy]="p.y" r="4" [attr.fill]="s.color" stroke="var(--c-surface)" stroke-width="2" (mouseenter)="hover.set(s.name + ' · ' + p.label + ': ' + p.text)" (mouseleave)="hover.set('')"><title>{{ s.name }} · {{ p.label }}: {{ p.text }}</title></circle> } }
    </svg>
    @if (series().length > 1) { <figcaption class="lg">@for (s of paths(); track s.name) { <span><i [style.background]="s.color"></i>{{ s.name }}</span> }</figcaption> }
    <div class="hv" aria-hidden="true">{{ hover() }}</div>
    <div class="sr-only"><table><caption>{{ label() }}</caption><thead><tr><th>Period</th>@for (s of series(); track s.name) { <th>{{ s.name }}</th> }</tr></thead><tbody>@for (p of series()[0]?.points ?? []; track $index; let i = $index) { <tr><td>{{ p.label }}</td>@for (s of series(); track s.name) { <td>{{ s.points[i]?.value }}</td> }</tr> }</tbody></table></div>
  </figure>`,
  styles: `.f { margin: 0; } svg { width: 100%; height: auto; display: block; } .ax { font-size: 11px; fill: var(--c-text-muted); font-family: var(--font-body); } circle { cursor: default; }
  .lg { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12px; color: var(--c-text-muted); margin-top: 6px; } .lg i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; } .hv { min-height: 18px; font-size: 12px; color: var(--c-text-muted); }`,
})
export class LineChartComponent {
  readonly series = input.required<ChartSeries[]>(); readonly label = input('Line chart'); readonly area = input(true); readonly prefix = input(''); readonly suffix = input('');
  readonly hover = signal('');
  readonly m = { l: 44, r: 14, t: 14, b: 28 };
  private max = computed(() => nice(Math.max(1, ...this.series().flatMap(s => s.points.map(p => p.value)))));
  readonly grid = computed(() => { const mx = this.max(); return [0, 1, 2, 3, 4].map(i => ({ y: 260 - this.m.b - (i / 4) * (260 - this.m.b - this.m.t), label: fmt((mx * i) / 4) })); });
  readonly xs = computed(() => { const p = this.series()[0]?.points ?? []; const w = 640 - this.m.l - this.m.r; return p.map((pt, i) => ({ label: pt.label, x: this.m.l + (p.length > 1 ? (i / (p.length - 1)) * w : w / 2) })); });
  readonly paths = computed(() => {
    const mx = this.max(); const w = 640 - this.m.l - this.m.r; const h = 260 - this.m.t - this.m.b;
    return this.series().map((s, si) => {
      const pts = s.points.map((p, i) => ({ x: this.m.l + (s.points.length > 1 ? (i / (s.points.length - 1)) * w : w / 2), y: this.m.t + h - (p.value / mx) * h, label: p.label, text: this.prefix() + p.value.toLocaleString('en-US') + this.suffix() }));
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
      const area = pts.length ? `${d} L${pts[pts.length - 1].x},${this.m.t + h} L${pts[0].x},${this.m.t + h} Z` : '';
      return { name: s.name, d, area, pts, color: PALETTE[si % PALETTE.length] };
    });
  });
}

@Component({
  selector: 'app-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <figure class="f">
    <svg viewBox="0 0 640 260" role="img" [attr.aria-label]="label()">
      @for (g of grid(); track g.y) { <line [attr.x1]="m.l" [attr.x2]="640 - m.r" [attr.y1]="g.y" [attr.y2]="g.y" stroke="var(--c-border)" stroke-dasharray="3 4"/><text [attr.x]="m.l - 8" [attr.y]="g.y + 4" text-anchor="end" class="ax">{{ g.label }}</text> }
      @for (b of bars(); track b.label + $index) { <rect [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" rx="4" [attr.fill]="color()"><title>{{ b.label }}: {{ b.text }}</title></rect><text [attr.x]="b.x + b.w / 2" y="248" text-anchor="middle" class="ax">{{ b.label }}</text> }
    </svg>
    <div class="sr-only"><table><caption>{{ label() }}</caption><tbody>@for (p of data(); track $index) { <tr><th>{{ p.label }}</th><td>{{ p.value }}</td></tr> }</tbody></table></div>
  </figure>`,
  styles: `.f { margin: 0; } svg { width: 100%; height: auto; display: block; } .ax { font-size: 11px; fill: var(--c-text-muted); }`,
})
export class BarChartComponent {
  readonly data = input.required<TimePoint[]>(); readonly label = input('Bar chart'); readonly color = input('#2563eb'); readonly prefix = input(''); readonly suffix = input('');
  readonly m = { l: 44, r: 14, t: 14, b: 28 };
  private max = computed(() => nice(Math.max(1, ...this.data().map(d => d.value))));
  readonly grid = computed(() => [0, 1, 2, 3, 4].map(i => ({ y: 260 - this.m.b - (i / 4) * (260 - this.m.b - this.m.t), label: fmt((this.max() * i) / 4) })));
  readonly bars = computed(() => {
    const d = this.data(); const w = 640 - this.m.l - this.m.r; const h = 260 - this.m.t - this.m.b; const slot = w / Math.max(1, d.length); const bw = Math.min(46, slot * 0.62);
    return d.map((p, i) => { const bh = (p.value / this.max()) * h; return { label: p.label, x: this.m.l + slot * i + (slot - bw) / 2, w: bw, h: bh, y: this.m.t + h - bh, text: this.prefix() + p.value.toLocaleString('en-US') + this.suffix() }; });
  });
}

/** Horizontal ranked bars — good for category / service popularity (labels stay readable on mobile). */
@Component({
  selector: 'app-hbar-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ul class="l" [attr.aria-label]="label()">@for (d of data(); track d.label) { <li><div class="r"><span class="n truncate">{{ d.label }}</span><span class="v tnum">{{ prefix() }}{{ d.value.toLocaleString('en-US') }}{{ suffix() }}</span></div><div class="t"><div class="b" [style.width.%]="(d.value / max()) * 100" [style.background]="color()"></div></div></li> }</ul>`,
  styles: `.l { display: flex; flex-direction: column; gap: 12px; } .r { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; margin-bottom: 4px; } .v { font-weight: 600; } .t { height: 8px; background: var(--c-surface-2); border-radius: 99px; overflow: hidden; } .b { height: 100%; border-radius: 99px; transition: width .5s var(--ease); }`,
})
export class HBarListComponent {
  readonly data = input.required<{ label: string; value: number }[]>(); readonly label = input('Ranking'); readonly color = input('var(--c-primary-600)'); readonly prefix = input(''); readonly suffix = input('');
  readonly max = computed(() => Math.max(1, ...this.data().map(d => d.value)));
}

@Component({
  selector: 'app-donut-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="w"><svg viewBox="0 0 120 120" role="img" [attr.aria-label]="label()"><circle cx="60" cy="60" r="44" fill="none" stroke="var(--c-surface-2)" stroke-width="16"/>
  @for (a of arcs(); track a.label) { <circle cx="60" cy="60" r="44" fill="none" [attr.stroke]="a.color" stroke-width="16" [attr.stroke-dasharray]="a.dash" [attr.stroke-dashoffset]="a.offset" transform="rotate(-90 60 60)"><title>{{ a.label }}: {{ a.value }}</title></circle> }
  <text x="60" y="58" text-anchor="middle" class="big">{{ total() }}</text><text x="60" y="74" text-anchor="middle" class="sm">{{ centerLabel() }}</text></svg>
  <ul class="lg">@for (a of arcs(); track a.label) { <li><i [style.background]="a.color"></i>{{ a.label }} <b>{{ a.value }}</b></li> }</ul></div>`,
  styles: `.w { display: flex; gap: 20px; align-items: center; flex-wrap: wrap; } svg { width: 150px; height: 150px; flex: none; } .big { font-family: var(--font-display); font-size: 22px; font-weight: 600; fill: var(--c-ink); } .sm { font-size: 8px; fill: var(--c-text-muted); } .lg { display: flex; flex-direction: column; gap: 6px; font-size: 13px; } i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 8px; } b { margin-left: 4px; }`,
})
export class DonutChartComponent {
  readonly data = input.required<{ label: string; value: number }[]>(); readonly label = input('Distribution'); readonly centerLabel = input('total');
  readonly total = computed(() => this.data().reduce((s, d) => s + d.value, 0));
  readonly arcs = computed(() => { const C = 2 * Math.PI * 44; let acc = 0; const t = this.total() || 1; return this.data().map((d, i) => { const len = (d.value / t) * C; const o = { label: d.label, value: d.value, color: PALETTE[i % PALETTE.length], dash: `${len} ${C - len}`, offset: -acc }; acc += len; return o; }); });
}
