import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { UploadRepository } from '../../core/api/repositories';
import { errorText } from '../../core/util/forms';
import { avatarImage } from '../../core/util/images';
import { ToastService } from '../services/overlay.services';
import { IconComponent } from './icon.component';

/**
 * Profile picture with a built-in default. Used by customers and photographers.
 * "Change photo" uploads an image and emits its address; "Use default" emits '' (the server then stores no picture and the default is shown again).
 * The parent decides where to save it.
 */
@Component({
  selector: 'app-avatar-editor',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="ae">
    <div class="pic"><img [src]="shown()" [alt]="'Profile picture of ' + name()" width="96" height="96" />@if (busy()) { <span class="spin" aria-hidden="true"><app-icon name="loader" [size]="22" /></span> }</div>
    <div class="side"><strong>Profile picture</strong>
      <span class="muted small">{{ custom() ? 'Your own photo.' : 'Default picture — add a photo so people recognise you.' }} JPG, PNG or WebP up to 8 MB.</span>
      <div class="row">
        <label class="btn btn--outline btn--sm" [class.is-disabled]="busy()"><app-icon name="camera" [size]="14" />{{ custom() ? 'Change photo' : 'Upload photo' }}<input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" [disabled]="busy()" (change)="pick($event)" /></label>
        @if (custom()) { <button type="button" class="btn btn--ghost btn--sm" [disabled]="busy()" (click)="reset()"><app-icon name="trash" [size]="14" />Use default</button> }
      </div></div>
  </div>`,
  styles: `.ae { display: flex; gap: 18px; align-items: center; flex-wrap: wrap; } .pic { position: relative; width: 96px; height: 96px; flex: none; } .pic img { width: 96px; height: 96px; border-radius: 50%; object-fit: cover; border: 3px solid var(--c-surface); box-shadow: var(--shadow-2, 0 2px 10px rgb(0 0 0 / 15%)); display: block; background: var(--c-surface-3); }
  .spin { position: absolute; inset: 0; border-radius: 50%; background: rgb(0 0 0 / 40%); color: #fff; display: grid; place-items: center; } .spin app-icon { animation: r 1s linear infinite; display: inline-flex; } @keyframes r { to { transform: rotate(360deg); } }
  .side { display: flex; flex-direction: column; gap: 6px; min-width: 0; flex: 1; } .row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; } label.btn { cursor: pointer; } label.is-disabled { opacity: .6; pointer-events: none; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }`,
})
export class AvatarEditorComponent {
  private uploads = inject(UploadRepository); private toast = inject(ToastService);
  /** Current stored address; empty or a generated placeholder means "default". */
  readonly src = input<string>(''); readonly name = input<string>('');
  /** Parent returns true/false through the callback-less contract: it saves the new address (or '' for default). */
  readonly changed = output<string>();
  readonly busy = signal(false); private local = signal<string | null>(null);
  readonly current = computed(() => this.local() ?? this.src() ?? '');
  readonly custom = computed(() => !!this.current() && !this.current().startsWith('data:image/svg+xml'));
  readonly shown = computed(() => (this.custom() ? this.current() : avatarImage(this.name())));

  pick(ev: Event) {
    const input = ev.target as HTMLInputElement; const file = input.files?.[0]; input.value = ''; if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 8 * 1024 * 1024) { this.toast.error('Use a JPEG, PNG or WebP image up to 8 MB.'); return; }
    this.busy.set(true);
    this.uploads.uploadAvatar(file).subscribe({ next: r => { this.busy.set(false); this.local.set(r.url); this.changed.emit(r.url); }, error: e => { this.busy.set(false); this.toast.error(errorText(e)); } });
  }
  reset() { this.local.set(''); this.changed.emit(''); }
}
