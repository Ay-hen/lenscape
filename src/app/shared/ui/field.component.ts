import { Component, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';

const MESSAGES: Record<string, (e: any, label: string) => string> = {
  required: (_e, l) => `${l} is required.`, email: () => 'Enter a valid email address.', minlength: e => `Use at least ${e.requiredLength} characters.`,
  maxlength: e => `Use at most ${e.requiredLength} characters.`, min: e => `Must be at least ${e.min}.`, max: e => `Must be at most ${e.max}.`,
  pattern: (_e, l) => `${l} has an invalid format.`, mismatch: () => 'Values do not match.', server: e => String(e), range: () => 'End must be after start.',
};

/**
 * Label + control + accessible validation message. The <label> wraps the control, so no id plumbing is needed.
 * Uses default change detection on purpose: reactive-form control state is mutable and not signal-based.
 */
@Component({
  selector: 'app-field',
  template: `<label class="field"><span class="field__label">{{ label() }}@if (required()) { <span aria-hidden="true"> *</span> }</span><ng-content />@if (hint() && !error) { <span class="field__hint">{{ hint() }}</span> }</label>@if (error; as e) { <div class="field__error" role="alert">{{ e }}</div> }`,
  styles: `:host { display: block; min-width: 0; } .field__error { margin-top: 6px; }`,
})
export class FieldComponent {
  readonly label = input.required<string>(); readonly hint = input(''); readonly control = input<AbstractControl | null>(null); readonly required = input(false);
  get error(): string | null {
    const c = this.control(); if (!c || !c.errors || !(c.touched || c.dirty)) return null;
    const key = Object.keys(c.errors)[0]; return (MESSAGES[key] ?? (() => 'Invalid value.'))(c.errors[key], this.label());
  }
}
