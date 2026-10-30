import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AdminRepository } from '../../core/api/repositories';
import { PlatformSettings } from '../../core/models';
import { errorText } from '../../core/util/forms';
import { SeoService } from '../../core/seo.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { TabsComponent } from '../../shared/ui/tabs.component';
import { ErrorStateComponent, PageHeaderComponent } from '../../shared/ui/misc';
import { ToastService } from '../../shared/services/overlay.services';

const TABS = [{ id: 'general', label: 'General' }, { id: 'categories', label: 'Categories' }, { id: 'featured', label: 'Featured' }, { id: 'content', label: 'FAQ & templates' }];

@Component({
  selector: 'app-admin-settings',
  imports: [FormsModule, IconComponent, TabsComponent, ErrorStateComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <app-page-header title="Platform settings" subtitle="Branding, commission and content.">
    @if (dirty()) { <button class="btn btn--ghost" type="button" (click)="reset()">Discard</button> }
    <button class="btn btn--primary" type="button" [disabled]="!dirty() || busy()" (click)="save()">{{ busy() ? 'Saving…' : 'Save settings' }}</button></app-page-header>
  <app-tabs [tabs]="tabs" [active]="tab()" label="Settings sections" (changed)="tab.set($event)" />
  @if (res.error()) { <app-error-state [error]="res.error()" (retry)="res.reload()" /> }
  @else if (!s()) { <div class="skeleton" style="height: 300px"></div> }
  @else { @let c = s()!;
    @switch (tab()) {
      @case ('general') { <div class="grid grid--2">
        <section class="card card--pad stack"><h3>Branding & localisation</h3>
          <label class="field"><span class="field__label">Brand name</span><input class="input" [ngModel]="c.brandName" (ngModelChange)="set(x => x.brandName = $event)" maxlength="40" /></label>
          <label class="field"><span class="field__label">Tagline</span><input class="input" [ngModel]="c.tagline" (ngModelChange)="set(x => x.tagline = $event)" maxlength="100" /></label>
          <label class="field"><span class="field__label">Currency</span><select class="select" [ngModel]="c.currency" (ngModelChange)="set(x => x.currency = $event)"><option value="MAD">MAD — Moroccan dirham</option><option value="EUR">EUR</option><option value="USD">USD</option></select></label>
          <label class="field"><span class="field__label">Locale</span><select class="select" [ngModel]="c.locale" (ngModelChange)="set(x => x.locale = $event)"><option value="en-GB">English (UK)</option><option value="fr-MA">Français (Maroc)</option><option value="ar-MA">العربية (المغرب)</option></select></label>
          <p class="muted xs">Currency and locale are stored here; this prototype renders MAD in English. Full multi-currency/translation needs backend support.</p></section>
        <section class="card card--pad stack"><h3>Commission & defaults</h3>
          <label class="field"><span class="field__label">Platform commission (%)</span><input class="input" type="number" min="0" max="40" step="0.5" [ngModel]="c.commissionPercent" (ngModelChange)="set(x => x.commissionPercent = +$event)" /><span class="field__hint">Applied to each booking value (0–40%). Photographers see it as an estimated fee.</span></label>
          <label class="field"><span class="field__label">Default free-cancellation window (hours)</span><input class="input" type="number" min="0" [ngModel]="c.defaultFreeCancelHours" (ngModelChange)="set(x => x.defaultFreeCancelHours = +$event)" /></label>
          <label class="field"><span class="field__label">Default minimum notice (hours)</span><input class="input" type="number" min="0" [ngModel]="c.defaultMinNoticeHours" (ngModelChange)="set(x => x.defaultMinNoticeHours = +$event)" /></label></section>
        <section class="card card--pad stack full"><h3>Site-wide banner</h3><label class="field"><span class="field__label">Message shown at the top of every public page</span><input class="input" [ngModel]="c.maintenanceBanner" (ngModelChange)="set(x => x.maintenanceBanner = $event)" maxlength="160" placeholder="e.g. Scheduled maintenance on Sunday 02:00–03:00" /><span class="field__hint">Leave empty to hide the banner.</span></label></section></div> }
      @case ('categories') { <section class="card card--pad stack"><p class="muted small">Categories drive filters and the home page. Featured categories appear on the home page.</p>
        @for (k of c.categories; track k.id) { <div class="rw"><input class="input" [ngModel]="k.name" (ngModelChange)="setCat(k.id, { name: $event })" [attr.aria-label]="'Category name'" /><label class="check"><input type="checkbox" [ngModel]="k.featured" (ngModelChange)="setCat(k.id, { featured: $event })" /><span>Featured</span></label><button type="button" class="btn btn--icon btn--ghost" (click)="removeCat(k.id)" aria-label="Remove category"><app-icon name="trash" [size]="16" /></button></div> }
        <div class="rw"><input class="input" [(ngModel)]="newCat" (keydown.enter)="addCat()" placeholder="New category name" aria-label="New category name" /><button type="button" class="btn btn--outline" (click)="addCat()">Add category</button></div></section> }
      @case ('featured') { <section class="card card--pad stack"><p class="muted small">Featured photographers are boosted in “Recommended” sorting and shown on the home page. Only approved photographers can be featured.</p>
        <div class="chips">@for (p of approved(); track p.photographerId) { <button type="button" class="chip" [attr.aria-pressed]="c.featuredPhotographerIds.includes(p.photographerId)" (click)="toggleFeatured(p.photographerId)">{{ p.displayName }}</button> } @empty { <span class="muted">No approved photographers yet.</span> }</div></section> }
      @case ('content') { <div class="stack">
        <section class="card card--pad stack"><h3>FAQ</h3>@for (f of c.faqs; track f.id) { <div class="qa"><input class="input" [ngModel]="f.q" (ngModelChange)="setFaq(f.id, { q: $event })" aria-label="Question" /><textarea class="textarea" rows="2" [ngModel]="f.a" (ngModelChange)="setFaq(f.id, { a: $event })" aria-label="Answer"></textarea><button type="button" class="btn btn--icon btn--ghost" (click)="removeFaq(f.id)" aria-label="Remove question"><app-icon name="trash" [size]="16" /></button></div> }
          <div><button type="button" class="btn btn--outline btn--sm" (click)="addFaq()"><app-icon name="plus" [size]="14" />Add question</button></div></section>
        <section class="card card--pad stack"><h3>Notification templates</h3>@for (t of c.notificationTemplates; track t.id) { <div class="qa"><input class="input" [ngModel]="t.name" (ngModelChange)="setTpl(t.id, { name: $event })" aria-label="Template name" /><textarea class="textarea" rows="2" [ngModel]="t.body" (ngModelChange)="setTpl(t.id, { body: $event })" aria-label="Template body"></textarea><span></span></div> } @empty { <p class="muted small">No templates.</p> }</section></div> }
    }
    @if (error()) { <div class="notice notice--error" role="alert">{{ error() }}</div> }
  }`,
  styles: `app-tabs { display: block; margin-bottom: 16px; } h3 { font-size: 1.1rem; } .full { grid-column: 1 / -1; } .rw { display: grid; grid-template-columns: 1fr auto auto; gap: 10px; align-items: center; } .chips { display: flex; flex-wrap: wrap; gap: 8px; } .qa { display: grid; grid-template-columns: 1fr 1.6fr auto; gap: 10px; align-items: start; } @media (max-width: 760px) { .qa { grid-template-columns: minmax(0, 1fr); } }`,
})
export class AdminSettingsPage {
  private repo = inject(AdminRepository); private toast = inject(ToastService);
  readonly tabs = TABS; readonly tab = signal('general'); newCat = '';
  readonly res = rxResource({ stream: () => forkJoin({ settings: this.repo.settings(), apps: this.repo.applications() }) });
  readonly s = signal<PlatformSettings | null>(null); readonly dirty = signal(false); readonly busy = signal(false); readonly error = signal('');
  readonly approved = computed(() => (this.res.value()?.apps ?? []).filter(a => a.status === 'approved'));
  constructor() { inject(SeoService).set('Settings'); effect(() => { const v = this.res.value(); if (v) { this.s.set(structuredClone(v.settings)); this.dirty.set(false); } }); }
  reset() { const v = this.res.value(); if (v) { this.s.set(structuredClone(v.settings)); this.dirty.set(false); this.error.set(''); } }
  set(f: (x: PlatformSettings) => void) { const c = structuredClone(this.s()!); f(c); this.s.set(c); this.dirty.set(true); }
  setCat(id: string, p: Partial<PlatformSettings['categories'][number]>) { this.set(x => { x.categories = x.categories.map(k => (k.id === id ? { ...k, ...p } : k)); }); }
  addCat() { const n = this.newCat.trim(); if (!n) return; const id = n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); if (!id || this.s()!.categories.some(k => k.id === id)) { this.toast.error('That category already exists.'); return; } this.set(x => { x.categories.push({ id, name: n, featured: false }); }); this.newCat = ''; }
  removeCat(id: string) { this.set(x => { x.categories = x.categories.filter(k => k.id !== id); }); }
  toggleFeatured(id: string) { this.set(x => { x.featuredPhotographerIds = x.featuredPhotographerIds.includes(id) ? x.featuredPhotographerIds.filter(v => v !== id) : [...x.featuredPhotographerIds, id]; }); }
  setFaq(id: string, p: Partial<PlatformSettings['faqs'][number]>) { this.set(x => { x.faqs = x.faqs.map(f => (f.id === id ? { ...f, ...p } : f)); }); }
  addFaq() { this.set(x => { x.faqs.push({ id: `faq-${Date.now()}`, q: '', a: '' }); }); }
  removeFaq(id: string) { this.set(x => { x.faqs = x.faqs.filter(f => f.id !== id); }); }
  setTpl(id: string, p: Partial<PlatformSettings['notificationTemplates'][number]>) { this.set(x => { x.notificationTemplates = x.notificationTemplates.map(t => (t.id === id ? { ...t, ...p } : t)); }); }
  save() {
    const c = this.s()!; if (!c.brandName.trim()) { this.error.set('Brand name is required.'); this.tab.set('general'); return; }
    if (c.faqs.some(f => !f.q.trim() || !f.a.trim())) { this.error.set('Every FAQ needs a question and an answer.'); this.tab.set('content'); return; }
    this.error.set(''); this.busy.set(true);
    this.repo.saveSettings(c).subscribe({ next: () => { this.busy.set(false); this.toast.success('Settings saved.'); this.res.reload(); }, error: e => { this.busy.set(false); this.error.set(errorText(e)); } });
  }
}
