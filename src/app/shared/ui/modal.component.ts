import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
import { IconComponent } from './icon.component';

/** Accessible modal built on the native <dialog> element (focus trap, Esc to close, inert background). */
@Component({
  selector: 'app-modal',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<dialog #d class="m" [class.m--wide]="wide()" [class.m--dark]="dark()" (cancel)="$event.preventDefault(); closed.emit()" (click)="backdrop($event)" [attr.aria-label]="label()">
    @if (open()) { <div class="in"><button type="button" class="close" aria-label="Close" (click)="closed.emit()"><app-icon name="x" /></button><ng-content /></div> }</dialog>`,
  styles: `.m { border: 0; padding: 0; border-radius: 18px; width: min(94vw, 560px); max-height: 92vh; box-shadow: var(--shadow-3); color: var(--c-text); background: var(--c-surface); overflow: hidden; }
  .m--wide { width: min(96vw, 960px); } .m--dark { background: #0f0d0c; color: #fff; width: min(96vw, 1100px); } .m::backdrop { background: rgb(20 17 15 / 70%); }
  .in { position: relative; max-height: 92vh; overflow: auto; } .close { position: absolute; top: 10px; right: 10px; z-index: 3; width: 36px; height: 36px; border-radius: 50%; border: 0; background: rgb(255 255 255 / 90%); color: #111; cursor: pointer; display: grid; place-items: center; box-shadow: var(--shadow-1); }`,
})
export class ModalComponent {
  readonly open = input.required<boolean>(); readonly label = input('Dialog'); readonly wide = input(false); readonly dark = input(false); readonly closed = output<void>();
  private d = viewChild.required<ElementRef<HTMLDialogElement>>('d');
  constructor() { effect(() => { const el = this.d().nativeElement; if (this.open() && !el.open) el.showModal(); else if (!this.open() && el.open) el.close(); }); }
  backdrop(e: MouseEvent) { if (e.target === this.d().nativeElement) this.closed.emit(); }
}
