import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NotificationsStore } from '../../core/state/stores';
import { AppNotification } from '../../core/models';
import { timeAgo } from '../../core/util/dates';
import { IconComponent } from '../ui/icon.component';
import { PageHeaderComponent } from '../ui/misc';
import { SeoService } from '../../core/seo.service';
import { ConfirmService } from '../services/overlay.services';
import { NOTE_META, groupByDay, metaOf } from '../notifications/notification-meta';

type Filter = 'all' | 'unread' | 'booking' | 'message' | 'review' | 'system';

@Component({
  selector: 'app-notifications-page',
  imports: [RouterLink, IconComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <app-page-header title="Notifications" subtitle="Everything that happens with your bookings, messages and reviews.">
    <button class="btn btn--outline" type="button" [disabled]="!store.unread()" (click)="store.markRead('all')"><app-icon name="check-check" [size]="16" />Mark all as read</button>
    <button class="btn btn--outline" type="button" [disabled]="!store.items().length" (click)="clearAll()"><app-icon name="trash" [size]="16" />Clear all</button>
  </app-page-header>

  <div class="inbox">
    <div class="bar" role="tablist" aria-label="Filter notifications">
      @for (f of filters; track f.key) {
        <button type="button" role="tab" class="seg" [class.on]="filter() === f.key" [attr.aria-selected]="filter() === f.key" (click)="filter.set(f.key)">
          @if (f.icon) { <app-icon [name]="f.icon" [size]="14" /> }{{ f.label }}@if (f.key === 'unread' && store.unread()) { <b>{{ store.unread() }}</b> }
        </button>
      }
    </div>

    @if (!shown().length) {
      <div class="empty"><span class="ring"><app-icon [name]="filter() === 'unread' ? 'check-circle' : 'bell'" [size]="28" /></span>
        <strong>{{ filter() === 'unread' ? 'You’re all caught up' : 'Nothing here yet' }}</strong>
        <span class="muted">{{ filter() === 'unread' ? 'No unread notifications. Nice.' : 'New activity will show up here the moment it happens.' }}</span></div>
    } @else {
      @for (g of groups(); track g.label) {
        <section class="grp" [attr.aria-label]="g.label"><h2>{{ g.label }}</h2>
          <ul>@for (n of g.items; track n.id; let i = $index) {
            <li class="item" [class.un]="!n.read" [style.--d]="(i < 8 ? i : 8) * 30 + 'ms'">
              <a [routerLink]="n.link || null" (click)="open(n, $event)">
                <span class="tile" [attr.data-tone]="meta(n.type).tone"><app-icon [name]="meta(n.type).icon" [size]="20" /></span>
                <span class="txt"><span class="top"><strong>{{ n.title }}</strong><time class="when" [attr.datetime]="n.createdAt">{{ ago(n.createdAt) }}</time></span>
                  <span class="body">{{ n.body }}</span></span>
                @if (!n.read) { <i class="dot" aria-label="Unread"></i> }
              </a>
              <div class="acts">@if (!n.read) { <button type="button" class="mk" title="Mark as read" aria-label="Mark as read" (click)="store.markRead(n.id)"><app-icon name="check" [size]="15" /></button> }
                <button type="button" class="rm" title="Delete" aria-label="Delete notification" (click)="store.remove(n.id)"><app-icon name="trash" [size]="15" /></button></div>
            </li> }</ul></section>
      }
    }
  </div>`,
  styles: `
  .inbox { max-width: 820px; display: flex; flex-direction: column; gap: 18px; }
  .bar { display: flex; gap: 6px; overflow-x: auto; padding: 4px; background: var(--c-surface-2); border-radius: 999px; width: fit-content; max-width: 100%; scrollbar-width: none; } .bar::-webkit-scrollbar { display: none; }
  .seg { display: inline-flex; align-items: center; gap: 6px; border: 0; background: transparent; color: var(--c-text-muted); font: inherit; font-size: 13.5px; font-weight: 600; padding: 8px 14px; border-radius: 999px; cursor: pointer; white-space: nowrap; transition: background .15s, color .15s, box-shadow .15s; }
  .seg:hover { color: var(--c-text); } .seg.on { background: var(--c-surface); color: var(--c-text); box-shadow: 0 1px 3px rgb(15 23 42 / 12%); }
  .seg b { background: var(--c-primary-600); color: #fff; border-radius: 999px; font-size: 11px; min-width: 18px; height: 18px; display: grid; place-items: center; padding: 0 5px; }
  .grp h2 { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--c-text-subtle); font-weight: 700; margin: 6px 4px 10px; }
  ul { display: flex; flex-direction: column; gap: 10px; }
  .item { position: relative; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 18px; transition: transform .15s ease, box-shadow .15s ease, border-color .15s; animation: in .35s ease both; animation-delay: var(--d, 0ms); }
  .item:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgb(15 23 42 / 8%); border-color: var(--c-border-strong); }
  .item.un { background: linear-gradient(90deg, var(--c-primary-50), var(--c-surface) 55%); border-color: var(--c-primary-200); }
  .item a { display: flex; gap: 14px; align-items: flex-start; padding: 16px 52px 16px 16px; color: inherit; text-decoration: none; border-radius: inherit; }
  .item a:focus-visible { outline: 2px solid var(--c-primary-600); outline-offset: 2px; }
  .tile { width: 44px; height: 44px; border-radius: 14px; display: grid; place-items: center; flex: none; background: var(--c-surface-2); color: var(--c-text-muted); }
  .tile[data-tone='blue'] { background: var(--c-primary-100); color: var(--c-primary-700); } .tile[data-tone='teal'] { background: var(--c-secondary-50); color: var(--c-secondary-500); }
  .tile[data-tone='amber'] { background: var(--c-accent-soft); color: var(--c-accent-ink); } .tile[data-tone='green'] { background: var(--c-success-bg); color: var(--c-success); } .tile[data-tone='slate'] { background: var(--c-info-bg); color: var(--c-info); }
  .txt { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; } .top { display: flex; gap: 12px; justify-content: space-between; align-items: baseline; }
  .top strong { font-size: 15px; } .item:not(.un) .top strong { font-weight: 600; color: var(--c-text-muted); } .when { font-size: 12px; color: var(--c-text-subtle); white-space: nowrap; }
  .body { color: var(--c-text-muted); font-size: 14px; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .dot { position: absolute; top: 18px; right: 18px; width: 9px; height: 9px; border-radius: 50%; background: var(--c-primary-600); box-shadow: 0 0 0 4px var(--c-primary-100); }
  .acts { position: absolute; right: 10px; bottom: 10px; display: flex; gap: 6px; }
  .mk, .rm { width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--c-border); background: var(--c-surface); color: var(--c-text-muted); display: grid; place-items: center; cursor: pointer; opacity: 0; transition: opacity .15s, background .15s; }
  .item:hover .mk, .item:hover .rm, .mk:focus-visible, .rm:focus-visible { opacity: 1; } .mk:hover { background: var(--c-success-bg); color: var(--c-success); } .rm:hover { color: var(--c-error); } @media (hover: none) { .mk, .rm { opacity: 1; } }
  .empty { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; padding: 64px 16px; background: var(--c-surface); border: 1px dashed var(--c-border-strong); border-radius: 22px; }
  .ring { width: 72px; height: 72px; border-radius: 50%; display: grid; place-items: center; background: var(--c-primary-50); color: var(--c-primary-600); margin-bottom: 8px; }
  @keyframes in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { .item { animation: none; transition: none; } }
  @media (max-width: 520px) { .item a { padding-right: 40px; } .top { flex-direction: column; gap: 0; } }`,
})
export class NotificationsPage {
  readonly store = inject(NotificationsStore); private router = inject(Router); private confirm = inject(ConfirmService);
  readonly meta = metaOf; readonly ago = (i: string) => timeAgo(i);
  readonly filter = signal<Filter>('all');
  readonly filters: { key: Filter; label: string; icon?: string }[] = [{ key: 'all', label: 'All' }, { key: 'unread', label: 'Unread' },
    ...(['booking', 'message', 'review', 'system'] as const).map(k => ({ key: k as Filter, label: NOTE_META[k].label, icon: NOTE_META[k].icon }))];
  readonly shown = computed(() => { const f = this.filter(); const l = this.store.items(); return f === 'all' ? l : f === 'unread' ? l.filter(n => !n.read) : l.filter(n => n.type === f); });
  readonly groups = computed(() => groupByDay(this.shown()));
  constructor() { inject(SeoService).set('Notifications'); this.store.refresh(); }
  async clearAll() { const r = await this.confirm.ask({ title: 'Clear all notifications?', message: 'This removes every notification from your list.', confirmText: 'Clear all', danger: true }); if (r.ok) this.store.clear('all'); }
  open(n: AppNotification, ev: Event) { this.store.markRead(n.id); if (!n.link) ev.preventDefault(); }
}