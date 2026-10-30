import { AbstractControl, FormGroup } from '@angular/forms';
import { ApiError } from '../models';

/** Pushes backend field errors (ApiError.details) onto form controls so they render next to the inputs. */
export function applyServerErrors(form: FormGroup, err: unknown): string {
  if (err instanceof ApiError) {
    for (const [k, v] of Object.entries(err.details ?? {})) { const c = form.get(k); if (c) { c.setErrors({ server: v }); c.markAsTouched(); } }
    return err.message;
  }
  return 'Something went wrong. Please try again.';
}
export function errorText(e: unknown): string { return e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Something went wrong.'; }
export function touchAll(c: AbstractControl) { c.markAllAsTouched(); }
export function passwordsMatch(a: string, b: string) { return (g: AbstractControl) => (g.get(a)?.value === g.get(b)?.value ? null : { mismatch: true }); }
