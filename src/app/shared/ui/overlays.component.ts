import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmService, ToastService } from '../services/overlay.services';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-overlays',
  imports: [FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toasts" aria-live="polite" aria-atomic="false">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast fade-in" [class]="'toast--' + t.kind" [attr.role]="t.kind === 'error' ? 'alert' : 'status'">
          <app-icon [name]="t.kind === 'success' ? 'check-circle' : t.kind === 'error' ? 'alert-triangle' : 'info'" />
          <span class="grow">{{ t.text }}</span>
          <button type="button" class="x" aria-label="Dismiss" (click)="toast.dismiss(t.id)"><app-icon name="x" [size]="14" /></button>
        </div>
      }
    </div>
    <dialog #dlg class="dlg" (cancel)="cancel($event)" (close)="onClosed()">
      @if (confirm.state(); as s) {
        <form method="dialog" (submit)="$event.preventDefault(); ok()">
          <h3>{{ s.title }}</h3>
          @if (s.message) { <p class="muted msg">{{ s.message }}</p> }
          @if (s.reasonLabel) {
            <label class="field"><span class="field__label">{{ s.reasonLabel }}@if (s.reasonRequired) { * }</span><textarea class="textarea" rows="3" [ngModel]="reason()" (ngModelChange)="reason.set($event)" name="reason"></textarea></label>
          }
          <div class="actions"><button type="button" class="btn btn--outline" (click)="cancelClick()">Cancel</button>
            <button type="submit" class="btn" [class.btn--danger]="s.danger" [class.btn--primary]="!s.danger" [disabled]="!!s.reasonRequired && reason().trim().length < 5">{{ s.confirmText || 'Confirm' }}</button></div>
        </form>
      }
    </dialog>`,
  styles: `
    .toasts { position: fixed; right: 16px; bottom: 16px; z-index: 2000; display: flex; flex-direction: column; gap: 8px; max-width: min(92vw, 380px); }
    .toast { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 12px; background: var(--c-ink-bg); color: #fff; box-shadow: var(--shadow-3); font-size: 14px; }
    .toast--success app-icon { color: #6fd5a1; } .toast--error { background: #7f1d17; } .toast--error app-icon { color: #ffb4ab; }
    .x { background: none; border: 0; color: inherit; opacity: .7; cursor: pointer; padding: 2px; } .x:hover { opacity: 1; }
    .dlg { border: 0; border-radius: 16px; padding: 24px; width: min(92vw, 440px); box-shadow: var(--shadow-3); color: var(--c-text); }
    .dlg::backdrop { background: rgb(20 17 15 / 55%); backdrop-filter: blur(2px); }
    form { display: flex; flex-direction: column; gap: 14px; } .msg { font-size: 14px; } .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }`,
})
export class OverlaysComponent {
  readonly toast = inject(ToastService); readonly confirm = inject(ConfirmService);
  readonly reason = signal('');
  private dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  constructor() {
    effect(() => {
      const s = this.confirm.state(); const d = this.dlg().nativeElement;
      if (s && !d.open) { this.reason.set(''); d.showModal(); } else if (!s && d.open) d.close();
    });
  }
  ok() { const s = this.confirm.state(); s?.resolve({ ok: true, reason: this.reason().trim() }); }
  cancelClick() { this.confirm.state()?.resolve({ ok: false, reason: '' }); }
  cancel(e: Event) { e.preventDefault(); this.cancelClick(); }
  onClosed() { if (this.confirm.state()) this.cancelClick(); }
}
