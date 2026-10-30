import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AutomationRepository, PhotographerWorkspaceRepository } from '../../core/api/repositories';
import { AutomationSettings, MessageTemplate, PromoCode } from '../../core/models';
import { errorText } from '../../core/util/forms';
import { SeoService } from '../../core/seo.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { TabsComponent } from '../../shared/ui/tabs.component';
import { ErrorStateComponent, PageHeaderComponent } from '../../shared/ui/misc';
import { ConfirmService, ToastService } from '../../shared/services/overlay.services';

const TABS = [{ id: 'rules', label: 'Rules' }, { id: 'templates', label: 'Message templates' }, { id: 'promos', label: 'Promo codes' }];
const VARS = ['{{customer}}', '{{service}}', '{{date}}', '{{time}}', '{{city}}', '{{reference}}', '{{days}}', '{{amount}}', '{{inclusions}}'];

/** Automation settings. These are RULES stored for the backend scheduler — nothing is sent from the browser. */
@Component({
  selector: 'app-studio-automation',
  imports: [FormsModule, IconComponent, TabsComponent, ErrorStateComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <app-page-header title="Automation" subtitle="Save time with rules for reminders, confirmations and follow-ups.">
    @if (tab() !== 'promos') { <button class="btn btn--primary" type="button" [disabled]="!dirty() || busy()" (click)="saveSettings()">{{ busy() ? 'Saving…' : 'Save automation' }}</button> }
  </app-page-header>
  <div class="notice notice--info" role="note"><app-icon name="info" [size]="18" /><div><strong>These rules run on the server, even when your browser is closed.</strong> Active now: auto-accept (applied the moment a request arrives), nudges and auto-expiry for unanswered requests, session reminders, thank-you notes and review requests (sent as in-app notifications to your customers, checked every few minutes). Stored but not sent yet: e-mail delivery, automatic confirmation chat messages, repeat-customer offers and gallery tracking.</div></div>
  <app-tabs [tabs]="tabs" [active]="tab()" label="Automation sections" (changed)="tab.set($event)" />
  @if (res.error()) { <app-error-state [error]="res.error()" (retry)="res.reload()" /> }
  @else if (!s()) { <div class="skeleton" style="height: 320px"></div> }
  @else { @let a = s()!;
    @switch (tab()) {
      @case ('rules') { <div class="grid grid--2 rules">
        <section class="card card--pad stack"><h3>New booking requests</h3><label class="sw"><input type="checkbox" [ngModel]="a.bookingRequestNotify.enabled" (ngModelChange)="set(x => x.bookingRequestNotify.enabled = $event)" />Notify me</label>
          @if (a.bookingRequestNotify.enabled) { <label class="check"><input type="checkbox" [ngModel]="a.bookingRequestNotify.inApp" (ngModelChange)="set(x => x.bookingRequestNotify.inApp = $event)" /><span>In-app notification</span></label><label class="check"><input type="checkbox" [ngModel]="a.bookingRequestNotify.email" (ngModelChange)="set(x => x.bookingRequestNotify.email = $event)" /><span>Email</span></label> }</section>
        <section class="card card--pad stack"><h3>Confirmation message</h3><label class="sw"><input type="checkbox" [ngModel]="a.confirmationMessage.enabled" (ngModelChange)="set(x => x.confirmationMessage.enabled = $event)" />Send when I confirm a booking</label>
          @if (a.confirmationMessage.enabled) { <label class="field"><span class="field__label">Template</span><select class="select" [ngModel]="a.confirmationMessage.templateId" (ngModelChange)="set(x => x.confirmationMessage.templateId = $event)">@for (t of msgs(); track t.id) { <option [value]="t.id">{{ t.name }}</option> }</select></label> }</section>
        <section class="card card--pad stack"><h3>Session reminders</h3><label class="sw"><input type="checkbox" [ngModel]="a.reminders.enabled" (ngModelChange)="set(x => x.reminders.enabled = $event)" />Remind the customer</label>
          @if (a.reminders.enabled) { <div class="chips">@for (h of [168, 72, 48, 24, 3]; track h) { <button type="button" class="chip" [attr.aria-pressed]="a.reminders.hoursBefore.includes(h)" (click)="toggleReminder(h)">{{ h >= 24 ? h / 24 + ' day' + (h > 24 ? 's' : '') : h + ' h' }} before</button> }</div>
            <label class="field"><span class="field__label">Template</span><select class="select" [ngModel]="a.reminders.templateId" (ngModelChange)="set(x => x.reminders.templateId = $event)">@for (t of msgs(); track t.id) { <option [value]="t.id">{{ t.name }}</option> }</select></label> }</section>
        <section class="card card--pad stack"><h3>Thank-you & follow-up</h3><label class="sw"><input type="checkbox" [ngModel]="a.followUp.enabled" (ngModelChange)="set(x => x.followUp.enabled = $event)" />After the session</label>
          @if (a.followUp.enabled) { <label class="field"><span class="field__label">Delay (hours)</span><input class="input" type="number" min="1" max="720" [ngModel]="a.followUp.delayHours" (ngModelChange)="set(x => x.followUp.delayHours = +$event)" /></label><label class="field"><span class="field__label">Template</span><select class="select" [ngModel]="a.followUp.templateId" (ngModelChange)="set(x => x.followUp.templateId = $event)">@for (t of msgs(); track t.id) { <option [value]="t.id">{{ t.name }}</option> }</select></label> }</section>
        <section class="card card--pad stack"><h3>Review request</h3><label class="sw"><input type="checkbox" [ngModel]="a.reviewRequest.enabled" (ngModelChange)="set(x => x.reviewRequest.enabled = $event)" />Ask for a review</label>
          @if (a.reviewRequest.enabled) { <label class="field"><span class="field__label">Delay after completion (hours)</span><input class="input" type="number" min="1" max="720" [ngModel]="a.reviewRequest.delayHours" (ngModelChange)="set(x => x.reviewRequest.delayHours = +$event)" /></label> }</section>
        <section class="card card--pad stack"><h3>Unanswered requests</h3>
          <label class="sw"><input type="checkbox" [ngModel]="a.pendingNudge.enabled" (ngModelChange)="set(x => x.pendingNudge.enabled = $event)" />Remind me if a request waits</label>
          @if (a.pendingNudge.enabled) { <label class="field"><span class="field__label">After (hours)</span><input class="input" type="number" min="1" max="168" [ngModel]="a.pendingNudge.afterHours" (ngModelChange)="set(x => x.pendingNudge.afterHours = +$event)" /></label> }
          <label class="sw"><input type="checkbox" [ngModel]="a.autoExpire.enabled" (ngModelChange)="set(x => x.autoExpire.enabled = $event)" />Expire requests I never answer</label>
          @if (a.autoExpire.enabled) { <label class="field"><span class="field__label">Expire after (hours)</span><input class="input" type="number" min="12" max="336" [ngModel]="a.autoExpire.afterHours" (ngModelChange)="set(x => x.autoExpire.afterHours = +$event)" /></label> }</section>
        <section class="card card--pad stack"><h3>Auto-accept <span class="tag">Use carefully</span></h3><label class="sw"><input type="checkbox" [ngModel]="a.autoAccept.enabled" (ngModelChange)="set(x => x.autoAccept.enabled = $event)" />Accept matching requests automatically</label>
          @if (a.autoAccept.enabled) { <div class="notice notice--warn small"><app-icon name="alert-triangle" [size]="16" />The server still checks availability and conflicts first. Only requests meeting <em>all</em> conditions below are accepted.</div>
            <label class="field"><span class="field__label">Minimum notice (hours, at least 12)</span><input class="input" type="number" min="12" [ngModel]="a.autoAccept.minNoticeHours" (ngModelChange)="set(x => x.autoAccept.minNoticeHours = +$event)" /></label>
            <label class="field"><span class="field__label">Maximum booking value (MAD)</span><input class="input" type="number" min="0" [ngModel]="a.autoAccept.maxPriceMad" (ngModelChange)="set(x => x.autoAccept.maxPriceMad = $event === '' || $event === null ? null : +$event)" /></label>
            <label class="check"><input type="checkbox" [ngModel]="a.autoAccept.repeatCustomersOnly" (ngModelChange)="set(x => x.autoAccept.repeatCustomersOnly = $event)" /><span>Repeat customers only</span></label> }</section>
        <section class="card card--pad stack"><h3>Repeat-customer offer</h3><label class="sw"><input type="checkbox" [ngModel]="a.repeatCustomerOffer.enabled" (ngModelChange)="set(x => x.repeatCustomerOffer.enabled = $event)" />Offer a discount on rebooking</label>
          @if (a.repeatCustomerOffer.enabled) { <label class="field"><span class="field__label">Discount (%)</span><input class="input" type="number" min="1" max="50" [ngModel]="a.repeatCustomerOffer.percent" (ngModelChange)="set(x => x.repeatCustomerOffer.percent = +$event)" /></label> }
          <label class="sw"><input type="checkbox" [ngModel]="a.galleryTracking.enabled" (ngModelChange)="set(x => x.galleryTracking.enabled = $event)" />Track gallery delivery status</label></section></div> }
      @case ('templates') { <div class="stack">
        <p class="muted small">Variables are filled in by the server: @for (v of vars; track v) { <code>{{ v }}</code> }</p>
        @for (t of a.templates; track t.id) { <section class="card card--pad stack"><div class="row"><input class="input grow" [ngModel]="t.name" (ngModelChange)="setTpl(t.id, { name: $event })" [attr.aria-label]="'Template name'" /><select class="select" style="max-width: 150px" [ngModel]="t.kind" (ngModelChange)="setTpl(t.id, { kind: $event })" aria-label="Template type"><option value="message">Message</option><option value="quotation">Quotation</option></select><button type="button" class="btn btn--icon btn--ghost" (click)="removeTpl(t)" aria-label="Delete template"><app-icon name="trash" [size]="16" /></button></div>
          <textarea class="textarea" rows="3" [ngModel]="t.body" (ngModelChange)="setTpl(t.id, { body: $event })" [attr.aria-label]="'Body of ' + t.name"></textarea></section> }
        <div><button type="button" class="btn btn--outline" (click)="addTpl()"><app-icon name="plus" [size]="15" />New template</button></div></div> }
      @case ('promos') { <section class="card card--pad stack"><p class="muted small">Customers enter a code in the booking wizard. The server validates it and applies the discount — the browser never decides the final price.</p>
        <table class="table"><thead><tr><th>Code</th><th>Discount %</th><th>Max uses</th><th>Used</th><th>Active</th><th><span class="sr-only">Remove</span></th></tr></thead><tbody>
          @for (c of promos(); track c.id) { <tr><td><input class="input" [ngModel]="c.code" (ngModelChange)="patchPromo(c.id, { code: ($event + '').toUpperCase().replace(' ', '') })" aria-label="Code" maxlength="20" /></td><td><input class="input" type="number" min="1" max="90" [ngModel]="c.percent" (ngModelChange)="patchPromo(c.id, { percent: +$event })" aria-label="Percent" /></td><td><input class="input" type="number" min="1" [ngModel]="c.maxUses" (ngModelChange)="patchPromo(c.id, { maxUses: $event ? +$event : undefined })" aria-label="Max uses" placeholder="∞" /></td><td>{{ c.uses }}</td><td><input type="checkbox" [ngModel]="c.active" (ngModelChange)="patchPromo(c.id, { active: $event })" aria-label="Active" /></td><td><button type="button" class="btn btn--icon btn--ghost" (click)="removePromo(c.id)" aria-label="Remove code"><app-icon name="trash" [size]="15" /></button></td></tr> } @empty { <tr><td colspan="6" class="muted">No codes yet.</td></tr> }</tbody></table>
        <div class="row"><button type="button" class="btn btn--outline" (click)="addPromo()"><app-icon name="plus" [size]="15" />Add code</button><span class="grow"></span><button type="button" class="btn btn--primary" [disabled]="!promoDirty() || busy()" (click)="savePromos()">Save codes</button></div></section> }
    }
    @if (error()) { <div class="notice notice--error" role="alert">{{ error() }}</div> }
  }`,
  styles: `.notice { margin-bottom: 16px; } h3 { font-size: 1.05rem; display: flex; gap: 8px; align-items: center; } .tag { font-size: 11px; background: var(--c-warning-bg, #fff3d6); color: var(--c-warning, #8a5a00); padding: 2px 8px; border-radius: 99px; font-weight: 600; } .sw { display: flex; align-items: center; gap: 10px; font-weight: 600; } .chips { display: flex; flex-wrap: wrap; gap: 8px; } code { background: var(--c-surface-2); padding: 1px 6px; border-radius: 6px; margin: 0 2px; font-size: 12px; } .rules { margin-top: 16px; align-items: start; } app-tabs { display: block; margin-bottom: 16px; } td .input { min-width: 90px; }`,
})
export class StudioAutomationPage {
  private repo = inject(AutomationRepository); private ws = inject(PhotographerWorkspaceRepository); private toast = inject(ToastService); private confirm = inject(ConfirmService);
  readonly tabs = TABS; readonly vars = VARS; readonly tab = signal('rules');
  readonly res = rxResource({ stream: () => forkJoin({ settings: this.repo.get(), promos: this.ws.promoCodes() }) });
  readonly s = signal<AutomationSettings | null>(null); readonly promos = signal<PromoCode[]>([]); readonly dirty = signal(false); readonly promoDirty = signal(false); readonly busy = signal(false); readonly error = signal('');
  constructor() { inject(SeoService).set('Automation'); effect(() => { const v = this.res.value(); if (v) { this.s.set(structuredClone(v.settings)); this.promos.set(structuredClone(v.promos)); this.dirty.set(false); this.promoDirty.set(false); } }); }
  msgs() { return (this.s()?.templates ?? []).filter(t => t.kind === 'message'); }
  set(f: (x: AutomationSettings) => void) { const c = structuredClone(this.s()!); f(c); this.s.set(c); this.dirty.set(true); }
  toggleReminder(h: number) { this.set(x => { const l = x.reminders.hoursBefore; x.reminders.hoursBefore = l.includes(h) ? l.filter(v => v !== h) : [...l, h].sort((a, b) => b - a); }); }
  setTpl(id: string, p: Partial<MessageTemplate>) { this.set(x => { x.templates = x.templates.map(t => (t.id === id ? { ...t, ...p } : t)); }); }
  addTpl() { this.set(x => { x.templates.push({ id: `t-${Date.now()}`, name: 'New template', kind: 'message', body: 'Hi {{customer}}, ' }); }); }
  async removeTpl(t: MessageTemplate) {
    const a = this.s()!; const inUse = [a.confirmationMessage.templateId, a.reminders.templateId, a.followUp.templateId].includes(t.id);
    const r = await this.confirm.ask({ title: `Delete “${t.name}”?`, message: inUse ? 'It is used by an automation rule — you will need to pick another template there.' : undefined, confirmText: 'Delete', danger: true }); if (!r.ok) return;
    this.set(x => { x.templates = x.templates.filter(v => v.id !== t.id); const fb = x.templates.find(v => v.kind === 'message')?.id ?? ''; for (const k of [x.confirmationMessage, x.reminders, x.followUp]) if (k.templateId === t.id) k.templateId = fb; });
  }
  saveSettings() {
    const a = this.s()!; if (a.templates.some(t => !t.name.trim() || !t.body.trim())) { this.error.set('Every template needs a name and a message.'); return; }
    if (a.reminders.enabled && !a.reminders.hoursBefore.length) { this.error.set('Choose at least one reminder time or turn reminders off.'); return; }
    this.error.set(''); this.busy.set(true);
    this.repo.save(a).subscribe({ next: () => { this.busy.set(false); this.toast.success('Automation saved.'); this.res.reload(); }, error: e => { this.busy.set(false); this.error.set(errorText(e)); } });
  }
  patchPromo(id: string, p: Partial<PromoCode>) { this.promos.update(l => l.map(c => (c.id === id ? { ...c, ...p } : c))); this.promoDirty.set(true); }
  addPromo() { this.promos.update(l => [...l, { id: `pc-${Date.now()}`, code: 'NEWCODE', percent: 10, active: true, uses: 0 }]); this.promoDirty.set(true); }
  removePromo(id: string) { this.promos.update(l => l.filter(c => c.id !== id)); this.promoDirty.set(true); }
  savePromos() {
    this.error.set(''); this.busy.set(true);
    this.ws.savePromoCodes(this.promos()).subscribe({ next: () => { this.busy.set(false); this.toast.success('Promo codes saved.'); this.res.reload(); }, error: e => { this.busy.set(false); this.error.set(errorText(e)); } });
  }
}
