import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PhotographerWorkspaceRepository } from '../../core/api/repositories';
import { ProfileCompletion } from '../../core/models';
import { errorText } from '../../core/util/forms';
import { ToastService } from '../../shared/services/overlay.services';
import { IconComponent } from '../../shared/ui/icon.component';

/** Reminder shown while a profile is incomplete. "Remind me later" is always possible; "Dismiss" unlocks at the server's threshold (80 %). */
@Component({
  selector: 'app-completion-banner',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  @if (data().showReminder) {
    <div class="notice notice--info bn" role="status">
      <app-icon name="info" [size]="18" />
      <div class="grow"><strong>Your profile is {{ data().percent }}% complete.</strong>
        @if (next(); as n) { Next step: <a [routerLink]="n.link">{{ n.label }}</a>. }</div>
      <button type="button" class="btn btn--sm btn--ghost" (click)="snooze()">Remind me later</button>
      @if (data().canDismiss) { <button type="button" class="btn btn--sm btn--outline" (click)="dismiss()">Dismiss</button> }
      @else { <span class="xs muted">Dismiss unlocks at {{ data().dismissThreshold }}%</span> }
    </div>
  }`,
  styles: `.bn { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; } .grow { flex: 1; min-width: 200px; }`,
})
export class CompletionBannerComponent {
  readonly data = input.required<ProfileCompletion>();
  readonly changed = output<void>();
  private ws = inject(PhotographerWorkspaceRepository); private toast = inject(ToastService);
  next() { return this.data().items.filter(i => !i.done).sort((a, b) => b.weight - a.weight)[0]; }
  snooze() { this.ws.snoozeCompletion().subscribe({ next: () => { this.toast.info('We’ll remind you later.'); this.changed.emit(); }, error: e => this.toast.error(errorText(e)) }); }
  dismiss() { this.ws.dismissCompletion().subscribe({ next: () => { this.toast.success('Reminder dismissed.'); this.changed.emit(); }, error: e => this.toast.error(errorText(e)) }); }
}