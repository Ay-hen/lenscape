import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, input, output, signal, untracked, viewChild } from '@angular/core';
import { ChatMessage, Conversation } from '../../../core/models';
import { buildThread } from '../../../core/util/chat';
import { IconComponent } from '../../ui/icon.component';
import { ChatComposerComponent } from '../chat-composer.component';

/**
 * The active conversation: header, scrollable message list and composer.
 *
 * Layout contract (this is what keeps the input on screen): the host is a height-bounded flex column; the header and the composer are
 * `flex: none`, and ONLY `.scroll` may scroll (`flex: 1 1 0; min-height: 0`). The composer is a sibling of the list, never inside it.
 *
 * All message text and names are rendered with interpolation, which Angular escapes: markup typed by a user is shown as plain text.
 */
@Component({
  selector: 'app-chat-thread',
  imports: [IconComponent, ChatComposerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <header class="hd">
    <button type="button" class="btn btn--ghost btn--icon btn--sm back" aria-label="Back to conversations" (click)="back.emit()"><app-icon name="arrow-left" /></button>
    <img class="av" [src]="otherAvatar()" alt="" width="40" height="40" />
    <div class="who">
      <strong class="nm">{{ otherName() }}</strong>
      <span class="sub" [class.live]="typing()" aria-live="polite">{{ typing() ? firstName() + ' is typing…' : subtitle() }}</span>
    </div>
  </header>

  <div class="body">
    <div class="scroll" #scroll role="log" aria-label="Messages" aria-live="polite" (scroll)="onScroll()">
      @if (hasMore()) {
        <button type="button" class="older" [disabled]="loadingOlder()" (click)="loadOlder.emit()">{{ loadingOlder() ? 'Loading…' : 'Load earlier messages' }}</button>
      }
      @for (it of items(); track it.key) {
        @if (it.kind === 'day') {
          <div class="day"><span>{{ it.label }}</span></div>
        } @else {
          <div class="line" [class.mine]="it.mine" [class.gs]="it.groupStart" [class.ge]="it.groupEnd">
            <div class="bubble" [class.pending]="it.state === 'sending'" [class.failed]="it.state === 'failed'">
              <p>{{ it.message.text }}</p>
              <span class="meta">
                {{ it.time }}
                @switch (it.state) {
                  @case ('sending') { <app-icon name="clock" [size]="12" /><span class="sr">Sending</span> }
                  @case ('failed') { <app-icon name="alert-triangle" [size]="12" /><span class="sr">Not sent</span> }
                  @case ('sent') { <app-icon name="check" [size]="14" /><span class="sr">Sent</span> }
                  @case ('read') { <app-icon name="check-check" [size]="14" /><span class="sr">Read</span> }
                }
              </span>
            </div>
            @if (it.state === 'failed') { <span class="fail">Not sent · <button type="button" class="link-btn" (click)="retry.emit(it.message)">Retry</button></span> }
          </div>
        }
      } @empty {
        <div class="hello"><app-icon name="message-circle" [size]="26" /><p>No messages yet. Say hello to {{ firstName() }}.</p></div>
      }
      @if (typing()) {
        <div class="line gs ge"><div class="bubble typing" role="status" [attr.aria-label]="firstName() + ' is typing'"><i></i><i></i><i></i></div></div>
      }
    </div>
    @if (unseen() > 0) {
      <button type="button" class="jump" (click)="jumpToLatest()"><app-icon name="chevron-down" [size]="16" />{{ unseen() }} new {{ unseen() === 1 ? 'message' : 'messages' }}</button>
    }
  </div>

  <app-chat-composer [draft]="draft()" [focusKey]="conversation().id" (draftChange)="draftChange.emit($event)" (send)="send.emit()" />`,
  styles: `
    :host { display: flex; flex-direction: column; flex: 1 1 0; min-height: 0; min-width: 0; }
    .hd { flex: none; display: flex; gap: 10px; align-items: center; padding: 10px 16px; border-bottom: 1px solid var(--c-border); background: var(--c-surface); }
    .back { display: none; }
    .av { flex: none; width: 40px; height: 40px; border-radius: 50%; object-fit: cover; display: block; }
    .who { min-width: 0; display: flex; flex-direction: column; }
    .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sub { font-size: 12px; color: var(--c-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sub.live { color: var(--c-primary-text); font-weight: 600; }

    .body { position: relative; flex: 1 1 0; min-height: 0; display: flex; }
    .scroll { flex: 1 1 0; min-width: 0; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 12px 16px 16px; display: flex; flex-direction: column; background: var(--c-bg); }

    .older { align-self: center; margin-bottom: 8px; padding: 6px 14px; border: 1px solid var(--c-border-strong); border-radius: 999px; background: var(--c-surface); color: var(--c-text-muted); font-size: 12px; cursor: pointer; }
    .older:disabled { opacity: .6; cursor: default; }
    .day { position: sticky; top: 4px; z-index: 1; align-self: center; margin: 12px 0 8px; pointer-events: none; }
    .day span { display: inline-block; padding: 4px 12px; border-radius: 999px; background: var(--c-surface); border: 1px solid var(--c-border); color: var(--c-text-muted); font-size: 12px; font-weight: 600; box-shadow: var(--shadow-1); }

    .line { display: flex; flex-direction: column; align-items: flex-start; margin-top: 2px; animation: pop .16s ease-out; }
    .line.gs { margin-top: 10px; }
    .line.mine { align-items: flex-end; }
    .bubble { max-width: min(74%, 560px); padding: 7px 12px 5px; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 6px 18px 18px 6px; }
    .line.gs .bubble { border-top-left-radius: 18px; }
    .line.ge .bubble { border-bottom-left-radius: 6px; border-bottom-right-radius: 18px; }
    .line.mine .bubble { background: var(--c-primary-600); border-color: var(--c-primary-600); color: #fff; border-radius: 18px 6px 6px 18px; }
    .line.mine.gs .bubble { border-top-right-radius: 18px; }
    .line.mine.ge .bubble { border-bottom-right-radius: 6px; border-bottom-left-radius: 18px; }
    .bubble.pending { opacity: .7; }
    .bubble.failed { background: var(--c-error-bg); border-color: var(--c-error); color: var(--c-text); }
    .bubble p { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
    .meta { display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-top: 2px; font-size: 11px; opacity: .75; line-height: 1; }
    .fail { margin-top: 2px; font-size: 12px; color: var(--c-error); }
    .link-btn { background: none; border: 0; padding: 0; color: inherit; text-decoration: underline; cursor: pointer; font: inherit; }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

    .typing { display: flex; gap: 4px; padding: 13px 16px; width: fit-content; }
    .typing i { width: 7px; height: 7px; border-radius: 50%; background: var(--c-text-muted); animation: bounce 1.1s infinite ease-in-out; }
    .typing i:nth-child(2) { animation-delay: .15s; } .typing i:nth-child(3) { animation-delay: .3s; }

    .hello { margin: auto; display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--c-text-muted); text-align: center; }
    .jump { position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%); display: inline-flex; gap: 4px; align-items: center; padding: 6px 14px; border: 0; border-radius: 999px; background: var(--c-ink-bg); color: #fff; font-size: 13px; cursor: pointer; box-shadow: var(--shadow-3); }

    @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); opacity: .45; } 30% { transform: translateY(-5px); opacity: 1; } }
    @keyframes pop { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .line, .typing i { animation: none; } }
    @media (max-width: 760px) { .back { display: inline-grid; } .bubble { max-width: 84%; } .scroll { padding-inline: 12px; } }
  `,
})
export class ChatThreadComponent {
  readonly conversation = input.required<Conversation>();
  readonly meId = input<string | undefined>(undefined);
  readonly otherId = input.required<string>();
  readonly otherName = input.required<string>();
  readonly otherAvatar = input.required<string>();
  readonly subtitle = input('');
  readonly typing = input(false);
  readonly hasMore = input(false);
  readonly loadingOlder = input(false);
  readonly draft = input('');

  readonly back = output<void>();
  readonly send = output<void>();
  readonly retry = output<ChatMessage>();
  readonly loadOlder = output<void>();
  readonly draftChange = output<string>();

  readonly firstName = computed(() => this.otherName().split(' ')[0] || this.otherName());
  readonly items = computed(() => buildThread(this.conversation().messages, this.meId(), this.conversation().unreadFor[this.otherId()] ?? 0));
  /** Messages that arrived while the reader was scrolled up. */
  readonly unseen = signal(0);

  private scroller = viewChild<ElementRef<HTMLElement>>('scroll');
  private stick = true;
  private lastConversation: string | null = null;
  private firstKey: string | undefined;
  private lastKey: string | undefined;
  private prevHeight = 0;

  constructor() {
    effect(() => {
      const its = this.items(); const id = this.conversation().id; void this.typing();
      const messages = its.filter(i => i.kind === 'msg');
      const first = messages[0]?.key; const lastItem = messages.at(-1);
      const lastIsMine = !!lastItem && lastItem.kind === 'msg' && lastItem.mine;
      const lastKey = lastItem?.key;
      // Wait for Angular to paint the new rows, then adjust the scroll position.
      untracked(() => queueMicrotask(() => this.afterChange(id, first, lastKey, lastIsMine)));
    });
  }

  private afterChange(conversationId: string, first: string | undefined, last: string | undefined, lastIsMine: boolean) {
    const el = this.scroller()?.nativeElement; if (!el) return;
    if (conversationId !== this.lastConversation) { // switched conversation: start at the newest message
      this.lastConversation = conversationId; this.stick = true; this.unseen.set(0);
      el.scrollTop = el.scrollHeight;
    } else if (this.firstKey !== undefined && first !== this.firstKey) { // older page added on top: keep what the reader was looking at
      el.scrollTop += el.scrollHeight - this.prevHeight;
    } else if (this.stick || lastIsMine) {
      this.scrollToBottom();
    } else if (last !== this.lastKey) {
      this.unseen.update(n => n + 1);
    }
    this.firstKey = first; this.lastKey = last; this.prevHeight = el.scrollHeight;
  }

  onScroll() {
    const el = this.scroller()?.nativeElement; if (!el) return;
    this.stick = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (this.stick && this.unseen()) this.unseen.set(0);
    if (el.scrollTop < 40 && this.hasMore() && !this.loadingOlder()) this.loadOlder.emit();
  }

  jumpToLatest() { this.unseen.set(0); this.stick = true; this.scrollToBottom(); }

  private scrollToBottom() {
    const el = this.scroller()?.nativeElement; if (!el) return;
    const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (typeof el.scrollTo === 'function') el.scrollTo({ top: el.scrollHeight, behavior: calm ? 'auto' : 'smooth' });
    else el.scrollTop = el.scrollHeight;
  }
}