import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ISODate } from '../../core/models';
import { formatDate, monthGrid, startOfMonth, parseISODate, toISODate, todayISO } from '../../core/util/dates';
import { IconComponent } from './icon.component';

export interface DayMark { count?: number; tone?: 'brand' | 'success' | 'warning' | 'muted' | 'error'; title?: string }

/** Month grid shared by the booking flow (date picking) and the photographer calendar (bookings overview). */
@Component({
  selector: 'app-month-calendar',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="cal">
    <div class="bar"><button type="button" class="btn btn--ghost btn--icon btn--sm" aria-label="Previous month" (click)="monthChange.emit(shift(-1))"><app-icon name="chevron-left" /></button>
      <strong aria-live="polite">{{ title() }}</strong>
      <button type="button" class="btn btn--ghost btn--icon btn--sm" aria-label="Next month" (click)="monthChange.emit(shift(1))"><app-icon name="chevron-right" /></button></div>
    <div class="grid" role="grid" [attr.aria-label]="title()">
      @for (w of week; track w) { <div class="wd" role="columnheader">{{ w }}</div> }
      @for (d of days(); track d.date) {
        <button type="button" role="gridcell" class="d" [class.out]="!d.inMonth" [class.sel]="d.date === selected()" [class.today]="d.date === today" [disabled]="d.disabled"
          [attr.aria-label]="fullLabel(d.date) + (d.mark?.title ? ', ' + d.mark.title : '')" [attr.aria-pressed]="d.date === selected()" [title]="d.mark?.title ?? ''" (click)="picked.emit(d.date)">
          <span>{{ d.n }}</span>@if (d.mark) { <i [class]="'m m--' + (d.mark.tone ?? 'brand')">@if (d.mark.count) { {{ d.mark.count }} }</i> }
        </button>
      }
    </div>
  </div>`,
  styles: `.bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; } strong { font-family: var(--font-display); font-size: 1.05rem; }
  .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; } .wd { text-align: center; font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--c-text-subtle); padding: 6px 0; }
  .d { position: relative; aspect-ratio: 1; min-height: 40px; border-radius: 10px; border: 1px solid transparent; background: transparent; cursor: pointer; font-size: 14px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; color: var(--c-text); transition: background .15s; }
  .d:hover:not(:disabled) { background: var(--c-surface-2); } .d:disabled { color: var(--c-border-strong); cursor: not-allowed; text-decoration: line-through; text-decoration-color: transparent; } .out { opacity: .38; } .today { border-color: var(--c-border-strong); font-weight: 700; }
  .sel, .sel:hover:not(:disabled) { background: var(--c-ink-bg); color: #fff; } .m { font-style: normal; min-width: 16px; height: 16px; border-radius: 8px; font-size: 10px; font-weight: 700; display: grid; place-items: center; padding: 0 4px; line-height: 1; }
  .m:empty { width: 6px; min-width: 6px; height: 6px; padding: 0; } .m--brand { background: var(--c-primary-600); color: #fff; } .m--success { background: var(--c-success-solid); color: #fff; } .m--warning { background: var(--c-accent); color: #3a2a00; } .m--muted { background: var(--c-border-strong); color: #fff; } .m--error { background: var(--c-error-solid); color: #fff; }`,
})
export class MonthCalendarComponent {
  readonly month = input.required<ISODate>(); readonly selected = input<ISODate | null>(null);
  readonly marks = input<Record<ISODate, DayMark>>({}); readonly isDisabled = input<(d: ISODate) => boolean>(() => false);
  readonly picked = output<ISODate>(); readonly monthChange = output<ISODate>();
  readonly today = todayISO(); readonly week = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  readonly title = computed(() => formatDate(this.month(), { month: 'long', year: 'numeric' }));
  readonly days = computed(() => { const m = startOfMonth(this.month()); const dis = this.isDisabled(); const marks = this.marks(); return monthGrid(m).map(date => ({ date, n: parseISODate(date).getDate(), inMonth: date.slice(0, 7) === m.slice(0, 7), disabled: dis(date), mark: marks[date] as DayMark | undefined })); });
  shift(n: number): ISODate { const d = parseISODate(this.month()); d.setDate(1); d.setMonth(d.getMonth() + n); return toISODate(d); }
  fullLabel(d: ISODate) { return formatDate(d, { weekday: 'long', day: 'numeric', month: 'long' }); }
}
