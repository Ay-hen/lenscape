import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Conversation } from '../../../core/models';
import { listStamp } from '../../../core/util/chat';
import { avatarImage } from '../../../core/util/images';
import { IconComponent } from '../../ui/icon.component';

/** Left column of the messaging screen: one row per conversation with avatar, last-message preview, time and unread badge. Presentational only. */
@Component({
  selector: 'app-conversation-list',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <ul aria-label="Conversations">
    @for (c of conversations(); track c.id) {
      <li class="item">
        <button type="button" class="row" [class.on]="c.id === activeId()" [attr.aria-current]="c.id === activeId() ? 'true' : null" (click)="select.emit(c)">
          <img class="av" [src]="avatar(c)" alt="" width="48" height="48" />
          <span class="mid">
            <span class="top">
              <strong class="nm">{{ other(c) }}</strong>
              <span class="when" [class.hot]="unread(c)">{{ stamp(c) }}</span>
            </span>
            <span class="bottom">
              <span class="pv" [class.strong]="unread(c)">
                @if (typing()[c.id]) { <em class="ty">typing…</em> } @else { {{ preview(c) }} }
              </span>
              @if (unread(c)) { <b class="badge" [attr.aria-label]="unread(c) + ' unread messages'">{{ unread(c) > 99 ? '99+' : unread(c) }}</b> }
            </span>
          </span>
        </button>
        <button type="button" class="del" title="Delete conversation" [attr.aria-label]="'Delete conversation with ' + other(c)" (click)="remove.emit(c)"><app-icon name="trash" [size]="15" /></button>
      </li>
    }
  </ul>`,
  styles: `
    :host { display: block; min-height: 0; overflow-y: auto; overscroll-behavior: contain; border-right: 1px solid var(--c-border); }
    .item { position: relative; }
    .del { position: absolute; top: 10px; right: 12px; width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--c-border); background: var(--c-surface); color: var(--c-text-muted); display: none; place-items: center; cursor: pointer; }
    .item:hover .del, .del:focus-visible { display: grid; } .item:hover .when { visibility: hidden; }
    @media (hover: none) { .del { display: grid; top: 50%; right: 8px; transform: translateY(-50%); } .row { padding-right: 44px; } }
    ul { margin: 0; padding: 0; list-style: none; }
    .row { display: flex; gap: 12px; align-items: center; width: 100%; padding: 12px 16px; border: 0; border-bottom: 1px solid var(--c-border); background: none; text-align: left; cursor: pointer; color: inherit; transition: background .15s; }
    .row:hover { background: var(--c-surface-2); }
    .row.on { background: var(--c-surface-2); box-shadow: inset 3px 0 0 var(--c-primary-600); }
    .row:focus-visible { outline: 2px solid var(--c-primary-600); outline-offset: -2px; }
    .av { flex: none; width: 48px; height: 48px; border-radius: 50%; object-fit: cover; display: block; }
    .mid { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .top, .bottom { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; }
    .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; }
    .when { flex: none; font-size: 12px; color: var(--c-text-subtle); }
    .when.hot { color: var(--c-primary-text); font-weight: 600; }
    .pv { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; color: var(--c-text-muted); }
    .pv.strong { color: var(--c-text); font-weight: 600; }
    .ty { color: var(--c-primary-text); font-style: normal; font-weight: 600; }
    .badge { flex: none; background: var(--c-primary-600); color: #fff; font-size: 11px; min-width: 20px; height: 20px; border-radius: 10px; display: grid; place-items: center; padding: 0 6px; }
  `,
})
export class ConversationListComponent {
  readonly conversations = input.required<Conversation[]>();
  readonly activeId = input<string | null>(null);
  /** Username of the signed-in user (conversation unread counters are keyed by it). */
  readonly meId = input<string | undefined>(undefined);
  readonly isClient = input(false);
  /** Conversation ids in which the other person is typing right now. */
  readonly typing = input<Record<string, true>>({});
  readonly select = output<Conversation>();
  readonly remove = output<Conversation>();

  other(c: Conversation) { return this.isClient() ? c.photographerName : c.customerName; }
  avatar(c: Conversation) { return avatarImage(this.other(c)); }
  unread(c: Conversation) { return c.unreadFor[this.meId() ?? ''] ?? 0; }
  stamp(c: Conversation) { const m = c.messages.at(-1); return m ? listStamp(m.at) : ''; }
  preview(c: Conversation) {
    const m = c.messages.at(-1);
    return m ? (m.senderId === this.meId() ? 'You: ' : '') + m.text.replace(/\s+/g, ' ') : 'No messages yet';
  }
}