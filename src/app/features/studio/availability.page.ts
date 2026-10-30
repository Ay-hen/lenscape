import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { switchMap } from 'rxjs';
import { AvailabilityRepository, PhotographerWorkspaceRepository } from '../../core/api/repositories';
import { AvailabilityRules, DateException, TimeRange } from '../../core/models';
import { formatDate, todayISO } from '../../core/util/dates';
import { errorText } from '../../core/util/forms';
import { SeoService } from '../../core/seo.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { ErrorStateComponent, PageHeaderComponent } from '../../shared/ui/misc';
import { ToastService } from '../../shared/services/overlay.services';

const DAYS = [{ i: 1, n: 'Monday' }, { i: 2, n: 'Tuesday' }, { i: 3, n: 'Wednesday' }, { i: 4, n: 'Thursday' }, { i: 5, n: 'Friday' }, { i: 6, n: 'Saturday' }, { i: 0, n: 'Sunday' }];

/** Weekly hours, buffers, blocked dates and one-off exceptions. The server stays authoritative for the final slot check. */
@Component({
  selector: 'app-studio-availability',
  imports: [FormsModule, IconComponent, ErrorStateComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <app-page-header title="Availability" subtitle="When customers can request a session. Existing bookings always block their slot.">
    @if (dirty()) { <button class="btn btn--ghost" type="button" (click)="reset()">Discard</button> }
    <button class="btn btn--primary" type="button" [disabled]="!dirty() || busy()" (click)="save()">{{ busy() ? 'Saving…' : 'Save availability' }}</button>
  </app-page-header>
  @if (res.error()) { <app-error-state [error]="res.error()" (retry)="res.reload()" /> }
  @else if (!r()) { <div class="skeleton" style="height: 360px"></div> }
  @else { @let rules = r()!;
    <div class="two">
      <section class="card card--pad stack"><h2>Weekly hours</h2>
        @for (d of days; track d.i) { @let day = rules.weekly[d.i];
          <div class="day"><label class="check"><input type="checkbox" [ngModel]="day.enabled" (ngModelChange)="setDay(d.i, $event)" [attr.aria-label]="d.n + ' available'" /><strong>{{ d.n }}</strong></label>
            <div class="rg">@if (!day.enabled) { <span class="muted small">Unavailable</span> }
              @else { @for (rg of day.ranges; track $index; let k = $index) { <div class="rr"><input class="input" type="time" [ngModel]="rg.start" (ngModelChange)="setRange(d.i, k, 'start', $event)" [attr.aria-label]="d.n + ' range ' + (k + 1) + ' start'" /><span>–</span><input class="input" type="time" [ngModel]="rg.end" (ngModelChange)="setRange(d.i, k, 'end', $event)" [attr.aria-label]="d.n + ' range ' + (k + 1) + ' end'" />
                @if (day.ranges.length > 1) { <button type="button" class="btn btn--icon btn--ghost" (click)="removeRange(d.i, k)" aria-label="Remove range"><app-icon name="x" [size]="14" /></button> }</div> }
                <button type="button" class="btn btn--sm btn--ghost" (click)="addRange(d.i)"><app-icon name="plus" [size]="13" />Add hours</button> }</div></div> }
      </section>
      <div class="stack">
        <section class="card card--pad stack"><h2>Booking rules</h2>
          <label class="field"><span class="field__label">Slot interval</span><select class="select" [ngModel]="rules.slotStepMinutes" (ngModelChange)="num('slotStepMinutes', $event)"><option [ngValue]="15">15 min</option><option [ngValue]="30">30 min</option><option [ngValue]="60">60 min</option></select></label>
          <label class="field"><span class="field__label">Buffer before a session (min)</span><input class="input" type="number" min="0" max="240" [ngModel]="rules.bufferBeforeMinutes" (ngModelChange)="num('bufferBeforeMinutes', $event)" /></label>
          <label class="field"><span class="field__label">Buffer after a session (min)</span><input class="input" type="number" min="0" max="240" [ngModel]="rules.bufferAfterMinutes" (ngModelChange)="num('bufferAfterMinutes', $event)" /></label>
          <label class="field"><span class="field__label">Minimum notice (hours)</span><input class="input" type="number" min="0" max="720" [ngModel]="rules.minNoticeHours" (ngModelChange)="num('minNoticeHours', $event)" /></label>
          <label class="field"><span class="field__label">Bookable up to (days ahead)</span><input class="input" type="number" min="1" max="730" [ngModel]="rules.maxAdvanceDays" (ngModelChange)="num('maxAdvanceDays', $event)" /></label></section>
        <section class="card card--pad stack"><h2>Time off</h2>
          @for (b of rules.blockedDates; track b.id) { <div class="it"><div><strong>{{ fmt(b.start) }}@if (b.end !== b.start) { – {{ fmt(b.end) }} }</strong><div class="muted small">{{ b.reason || 'Blocked' }}</div></div><button type="button" class="btn btn--icon btn--ghost" (click)="removeBlock(b.id)" aria-label="Remove time off"><app-icon name="trash" [size]="15" /></button></div> } @empty { <p class="muted small">No time off scheduled.</p> }
          <div class="add"><input class="input" type="date" [min]="today" [(ngModel)]="bFrom" aria-label="Time off from" /><input class="input" type="date" [min]="bFrom || today" [(ngModel)]="bTo" aria-label="Time off to (optional)" /><input class="input" [(ngModel)]="bReason" placeholder="Reason (private)" aria-label="Reason" /><button type="button" class="btn btn--sm btn--outline" (click)="addBlock()">Block dates</button></div></section>
        <section class="card card--pad stack"><h2>Special days</h2><p class="muted small">Override the weekly hours for a specific date.</p>
          @for (e of rules.exceptions; track e.date) { <div class="it"><div><strong>{{ fmt(e.date) }}</strong><div class="muted small">{{ e.ranges.length ? rangeText(e.ranges) : 'Closed' }}{{ e.note ? ' · ' + e.note : '' }}</div></div><button type="button" class="btn btn--icon btn--ghost" (click)="removeEx(e.date)" aria-label="Remove special day"><app-icon name="trash" [size]="15" /></button></div> }
          <div class="add"><input class="input" type="date" [min]="today" [(ngModel)]="xDate" aria-label="Special day date" /><input class="input" type="time" [(ngModel)]="xStart" aria-label="Opens" /><input class="input" type="time" [(ngModel)]="xEnd" aria-label="Closes" /><button type="button" class="btn btn--sm btn--outline" (click)="addEx()">Add day</button></div><p class="muted xs">Leave both times empty to close that day.</p></section>
      </div>
    </div>
    @if (error()) { <div class="notice notice--error" role="alert">{{ error() }}</div> }
  }`,
  styles: `.two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: start; } @media (max-width: 980px) { .two { grid-template-columns: minmax(0, 1fr); } } h2 { font-size: 1.2rem; }
  .day { display: grid; grid-template-columns: 150px 1fr; gap: 10px; padding: 10px 0; border-top: 1px solid var(--c-border); align-items: start; } .rg { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; } .rr { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; } .rr .input { width: 148px; padding-inline: 10px; } @media (max-width: 520px) { .day { grid-template-columns: minmax(0, 1fr); } }
  .it { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 8px 0; border-top: 1px solid var(--c-border); } .add { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(130px, 100%), 1fr)); gap: 8px; }`,
})
export class StudioAvailabilityPage {
  private ws = inject(PhotographerWorkspaceRepository); private repo = inject(AvailabilityRepository); private toast = inject(ToastService);
  readonly days = DAYS; readonly today = todayISO();
  readonly res = rxResource({ stream: () => this.ws.myProfile().pipe(switchMap(p => this.repo.rules(p.id))) });
  readonly r = signal<AvailabilityRules | null>(null); readonly dirty = signal(false); readonly busy = signal(false); readonly error = signal('');
  bFrom = ''; bTo = ''; bReason = ''; xDate = ''; xStart = ''; xEnd = '';
  readonly fmt = (d: string) => formatDate(d, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  readonly rangeText = (r: TimeRange[]) => r.map(x => `${x.start}–${x.end}`).join(', ');
  constructor() { inject(SeoService).set('Availability'); effect(() => { const v = this.res.value(); if (v) { this.r.set(structuredClone(v)); this.dirty.set(false); } }); }
  reset() { const v = this.res.value(); if (v) { this.r.set(structuredClone(v)); this.dirty.set(false); this.error.set(''); } }
  private mut(f: (r: AvailabilityRules) => void) { const c = structuredClone(this.r()!); f(c); this.r.set(c); this.dirty.set(true); }
  setDay(i: number, on: boolean) { this.mut(r => { r.weekly[i].enabled = on; if (on && !r.weekly[i].ranges.length) r.weekly[i].ranges = [{ start: '09:00', end: '17:00' }]; }); }
  setRange(i: number, k: number, f: 'start' | 'end', v: string) { this.mut(r => { r.weekly[i].ranges[k][f] = v; }); }
  addRange(i: number) { this.mut(r => { const last = r.weekly[i].ranges.at(-1); r.weekly[i].ranges.push({ start: last ? last.end : '09:00', end: '20:00' }); }); }
  removeRange(i: number, k: number) { this.mut(r => { r.weekly[i].ranges.splice(k, 1); }); }
  num(key: 'slotStepMinutes' | 'bufferBeforeMinutes' | 'bufferAfterMinutes' | 'minNoticeHours' | 'maxAdvanceDays', v: number | string) { this.mut(r => { r[key] = Math.max(0, Number(v) || 0); }); }
  addBlock() { if (!this.bFrom) { this.toast.error('Pick a start date.'); return; } const to = this.bTo || this.bFrom; if (to < this.bFrom) { this.toast.error('The end date is before the start.'); return; } this.mut(r => { r.blockedDates.push({ id: `b-${Date.now()}`, start: this.bFrom, end: to, reason: this.bReason.trim() }); }); this.bFrom = this.bTo = this.bReason = ''; }
  removeBlock(id: string) { this.mut(r => { r.blockedDates = r.blockedDates.filter(b => b.id !== id); }); }
  addEx() {
    if (!this.xDate) { this.toast.error('Pick a date.'); return; } if (!!this.xStart !== !!this.xEnd) { this.toast.error('Set both opening and closing times, or leave both empty.'); return; } if (this.xStart && this.xStart >= this.xEnd) { this.toast.error('Closing time must be after opening time.'); return; }
    const ex: DateException = { date: this.xDate, ranges: this.xStart ? [{ start: this.xStart, end: this.xEnd }] : [] };
    this.mut(r => { r.exceptions = [...r.exceptions.filter(e => e.date !== ex.date), ex].sort((a, b) => a.date.localeCompare(b.date)); }); this.xDate = this.xStart = this.xEnd = '';
  }
  removeEx(d: string) { this.mut(r => { r.exceptions = r.exceptions.filter(e => e.date !== d); }); }
  save() {
    const r = this.r()!; for (const d of r.weekly) if (d.enabled) for (const g of d.ranges) if (!g.start || !g.end || g.start >= g.end) { this.error.set('Every time range must end after it starts.'); return; }
    this.error.set(''); this.busy.set(true);
    this.repo.saveRules(r).subscribe({ next: () => { this.busy.set(false); this.toast.success('Availability saved.'); this.res.reload(); }, error: e => { this.busy.set(false); this.error.set(errorText(e)); } });
  }
}
