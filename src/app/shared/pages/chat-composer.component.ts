import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, input, output, viewChild } from '@angular/core';
import { IconComponent } from '../ui/icon.component';

const MAX_LENGTH = 2000; // keep in sync with app.chat.max-message-length on the server

/**
 * The message box. It is deliberately dumb and long-lived:
 * - the text is owned by the parent (per conversation), this component only edits the textarea and reports changes;
 * - the textarea is never re-created, so it keeps focus and caret while messages arrive or are sent;
 * - Enter sends, Shift+Enter inserts a line break, and IME composition (e.g. Arabic/Japanese input) is respected.
 */
@Component({
  selector: 'app-chat-composer',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <form class="composer" (submit)="submit($event)">
    <textarea #box class="input" rows="1" name="message" aria-label="Message" placeholder="Write a message…" autocomplete="off" enterkeyhint="send"
      [attr.maxlength]="max" (input)="onInput()" (keydown)="onKey($event)"></textarea>
    <button class="btn btn--primary send" type="submit" aria-label="Send message" [disabled]="!canSend()"><app-icon name="send" [size]="18" /></button>
  </form>
  @if (draft().length > 1800) { <div class="count" [class.max]="draft().length >= max" aria-live="polite">{{ draft().length }}/{{ max }}</div> }`,
  styles: `
    :host { display: block; flex: none; border-top: 1px solid var(--c-border); background: var(--c-surface); }
    .composer { display: flex; gap: 8px; align-items: flex-end; padding: 10px 12px; padding-bottom: max(10px, env(safe-area-inset-bottom)); }
    textarea { flex: 1; min-width: 0; resize: none; overflow-y: auto; max-height: 132px; line-height: 1.4; padding-block: 10px; border-radius: 20px; }
    .send { flex: none; width: 42px; height: 42px; padding: 0; border-radius: 50%; display: grid; place-items: center; }
    .count { padding: 0 16px 8px; text-align: right; font-size: 12px; color: var(--c-text-subtle); }
    .count.max { color: var(--c-error); font-weight: 600; }
  `,
})
export class ChatComposerComponent {
  /** Current text (owned by the parent). */
  readonly draft = input('');
  /** Changing this value (e.g. the conversation id) moves focus to the box on devices with a precise pointer. */
  readonly focusKey = input<string | null>(null);
  readonly draftChange = output<string>();
  readonly send = output<void>();
  readonly max = MAX_LENGTH;
  readonly canSend = computed(() => this.draft().trim().length > 0);
  private box = viewChild<ElementRef<HTMLTextAreaElement>>('box');

  constructor() {
    // Parent -> textarea (e.g. cleared after sending, or a stored draft when switching conversation). Skipped while the DOM already matches, so the caret never jumps.
    effect(() => {
      const value = this.draft(); const el = this.box()?.nativeElement;
      if (el && el.value !== value) { el.value = value; this.resize(el); }
    });
    effect(() => {
      this.focusKey(); const el = this.box()?.nativeElement;
      if (el && typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches) queueMicrotask(() => el.focus({ preventScroll: true }));
    });
  }

  onInput() {
    const el = this.box()?.nativeElement; if (!el) return;
    this.resize(el); this.draftChange.emit(el.value);
  }

  onKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); this.submit(); }
  }

  submit(e?: Event) {
    e?.preventDefault();
    const el = this.box()?.nativeElement; if (!el || !el.value.trim()) return;
    this.send.emit();
    el.focus({ preventScroll: true }); // keep the keyboard open on phones and the caret in place on desktop
  }

  private resize(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 132) + 'px';
  }
}