import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, model } from '@angular/core';
import { GearItem, GearKind } from '../../core/models';
import { GEAR_KINDS, GEAR_MAX_ITEMS, GEAR_MAX_NAME } from '../../core/util/gear';
import { IconComponent } from '../../shared/ui/icon.component';

/**
 * Editable list of equipment. Two-way bound: `<app-gear-editor [(items)]="gear" />`.
 * Empty rows are allowed while editing; the page runs cleanGear() before saving.
 */
@Component({
  selector: 'app-gear-editor',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="ge">
    @if (!items().length) { <p class="muted small">Nothing added yet. Choose a type below to add your first item.</p> }
    @for (it of items(); track $index; let i = $index) {
      <div class="ge__row">
        <select class="select ge__kind" [attr.aria-label]="'Type of item ' + (i + 1)" (change)="setKind(i, $any($event.target).value)">
          @for (k of kinds; track k.kind) { <option [value]="k.kind" [selected]="k.kind === it.kind">{{ k.label }}</option> }
        </select>
        <input class="input" [value]="it.name" [attr.maxlength]="maxName" [placeholder]="hint(it.kind)" [attr.aria-label]="'Name of item ' + (i + 1)" (input)="setName(i, $any($event.target).value)" />
        <button type="button" class="btn btn--ghost btn--icon" [attr.aria-label]="'Remove item ' + (i + 1)" (click)="remove(i)"><app-icon name="trash" [size]="16" /></button>
      </div>
    }
    <div class="ge__add" role="group" aria-label="Add equipment">
      @for (k of kinds; track k.kind) { <button type="button" class="chip" [disabled]="full()" (click)="add(k.kind)"><app-icon [name]="k.icon" [size]="14" />{{ k.label }}</button> }
    </div>
    @if (full()) { <p class="muted small">You reached the limit of ${GEAR_MAX_ITEMS} items.</p> }
  </div>`,
  styles: `.ge { display: flex; flex-direction: column; gap: 10px; } .ge__row { display: grid; grid-template-columns: 150px 1fr auto; gap: 8px; align-items: center; } .ge__add { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; } .chip { display: inline-flex; align-items: center; gap: 6px; } @media (max-width: 560px) { .ge__row { grid-template-columns: 1fr auto; } .ge__kind { grid-column: 1 / -1; } }`,
})
export class GearEditorComponent {
  readonly items = model.required<GearItem[]>();
  readonly kinds = GEAR_KINDS; readonly maxName = GEAR_MAX_NAME;
  readonly full = computed(() => this.items().length >= GEAR_MAX_ITEMS);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  hint(kind: GearKind) { return GEAR_KINDS.find(k => k.kind === kind)?.placeholder ?? ''; }
  add(kind: GearKind) {
    if (this.full()) return;
    this.items.update(l => [...l, { kind, name: '' }]);
    setTimeout(() => { const inputs = this.host.nativeElement.querySelectorAll<HTMLInputElement>('input.input'); inputs[inputs.length - 1]?.focus(); });
  }
  remove(i: number) { this.items.update(l => l.filter((_, x) => x !== i)); }
  setName(i: number, name: string) { this.items.update(l => l.map((it, x) => x === i ? { ...it, name } : it)); }
  setKind(i: number, kind: GearKind) { this.items.update(l => l.map((it, x) => x === i ? { ...it, kind } : it)); }
}
