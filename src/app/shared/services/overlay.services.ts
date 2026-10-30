import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';
export interface Toast { id: number; kind: ToastKind; text: string }

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private n = 0;
  show(kind: ToastKind, text: string, ms = 4500) {
    const id = ++this.n; this.toasts.update(t => [...t, { id, kind, text }]);
    setTimeout(() => this.dismiss(id), ms);
  }
  success(t: string) { this.show('success', t); }
  error(t: string) { this.show('error', t, 7000); }
  info(t: string) { this.show('info', t); }
  dismiss(id: number) { this.toasts.update(t => t.filter(x => x.id !== id)); }
}

export interface ConfirmOptions { title: string; message?: string; confirmText?: string; danger?: boolean; reasonLabel?: string; reasonRequired?: boolean }
export interface ConfirmState extends ConfirmOptions { resolve: (r: { ok: boolean; reason: string }) => void }

/** Promise-based confirmation dialog for sensitive actions. Rendered by <app-overlays> in the root. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly state = signal<ConfirmState | null>(null);
  ask(opts: ConfirmOptions): Promise<{ ok: boolean; reason: string }> {
    return new Promise(resolve => this.state.set({ ...opts, resolve: r => { this.state.set(null); resolve(r); } }));
  }
}
