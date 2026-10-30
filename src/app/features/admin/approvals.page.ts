import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AdminRepository } from '../../core/api/repositories';
import { Application } from '../../core/models';
import { CATEGORIES_BY_ID } from '../../core/util/categories';
import { formatDateTime, timeAgo } from '../../core/util/dates';
import { errorText } from '../../core/util/forms';
import { SeoService } from '../../core/seo.service';
import { AvatarComponent, EmptyStateComponent, ErrorStateComponent, PageHeaderComponent } from '../../shared/ui/misc';
import { BadgeComponent } from '../../shared/ui/badges';
import { IconComponent } from '../../shared/ui/icon.component';
import { ModalComponent } from '../../shared/ui/modal.component';
import { TabsComponent } from '../../shared/ui/tabs.component';
import { ConfirmService, ToastService } from '../../shared/services/overlay.services';

type Action = 'approved' | 'rejected' | 'info_requested' | 'identity_verified';

@Component({
  selector: 'app-admin-approvals',
  imports: [RouterLink, AvatarComponent, BadgeComponent, EmptyStateComponent, ErrorStateComponent, IconComponent, ModalComponent, PageHeaderComponent, TabsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <app-page-header title="Photographer approvals" subtitle="Review profiles before they appear in search." />
  <div class="notice notice--info" role="note"><app-icon name="info" [size]="18" /><div><strong>Approval is not identity verification.</strong> Approving means you reviewed the profile and portfolio. A “Verified identity” badge is a separate, manual step you should only apply after checking documents <em>outside</em> this app — it is never granted automatically.</div></div>
  <app-tabs [tabs]="tabs()" [active]="tab()" label="Application status" (changed)="tab.set($event)" />
  @if (res.error()) { <app-error-state [error]="res.error()" (retry)="res.reload()" /> }
  @else if (!res.value()) { <div class="skeleton" style="height: 240px"></div> }
  @else if (!list().length) { <app-empty-state icon="user-check" title="Nothing here" text="No applications in this state." /> }
  @else { <div class="grid grid--2">@for (a of list(); track a.photographerId) {
    <article class="card card--pad stack"><div class="hd"><app-avatar [src]="a.avatarUrl" [alt]="a.displayName" [size]="48" /><div class="grow"><strong>{{ a.displayName }}</strong><div class="muted small">{{ a.city }} · {{ a.email }}</div><div class="muted xs">Submitted {{ ago(a.submittedAt) }}</div></div><app-badge [status]="a.status" /></div>
      <div class="chips">@for (s of a.specialties; track s) { <span class="chip">{{ cat(s) }}</span> }</div>
      <div class="samples">@for (u of a.portfolioSamples.slice(0, 4); track u) { <img [src]="u" alt="Portfolio sample" loading="lazy" /> } @empty { <span class="muted small">No portfolio samples uploaded.</span> }</div>
      <div class="row"><span class="small">Identity:</span>@if (a.identityVerified) { <span class="chip chip--ok"><app-icon name="shield-check" [size]="13" />Verified by admin</span> } @else { <span class="muted small">Not verified</span> }</div>
      <div class="row"><button class="btn btn--sm btn--ghost" type="button" (click)="detail.set(a)">History</button><a class="btn btn--sm btn--ghost" [routerLink]="['/photographers', a.photographerId]" target="_blank">Public profile</a><span class="grow"></span>
        @if (a.status === 'pending' || a.status === 'needs_info') { <button class="btn btn--sm btn--ghost" type="button" (click)="act(a, 'info_requested')">Request info</button><button class="btn btn--sm btn--outline danger" type="button" (click)="act(a, 'rejected')">Reject</button><button class="btn btn--sm btn--primary" type="button" (click)="act(a, 'approved')">Approve</button> }
        @if (a.status === 'rejected') { <button class="btn btn--sm btn--primary" type="button" (click)="act(a, 'approved')">Approve anyway</button> }
        @if (a.status === 'approved' && !a.identityVerified) { <button class="btn btn--sm btn--outline" type="button" (click)="act(a, 'identity_verified')">Mark identity verified…</button> }</div></article> }</div> }
  <app-modal [open]="!!detail()" label="Application history" (closed)="detail.set(null)">@if (detail(); as a) { <div class="dt"><h2>{{ a.displayName }}</h2><ol class="tl">@for (h of a.history.slice().reverse(); track h.at + h.action) { <li><strong>{{ h.action.replace('_', ' ') }}</strong> <span class="muted small">by {{ h.actor }} · {{ dt(h.at) }}</span>@if (h.note) { <p class="small">{{ h.note }}</p> }</li> } @empty { <li class="muted">No history.</li> }</ol></div> }</app-modal>`,
  styles: `.notice { margin-bottom: 16px; } app-tabs { display: block; margin-bottom: 16px; } .hd { display: flex; gap: 12px; align-items: center; } .chips { display: flex; flex-wrap: wrap; gap: 6px; } .samples { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; } .samples img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 8px; } .row { flex-wrap: wrap; align-items: center; } .danger { color: var(--c-error); } .chip--ok { color: var(--c-success); display: inline-flex; gap: 4px; align-items: center; } .dt { padding: 28px; } h2 { font-size: 1.4rem; margin-bottom: 12px; } .tl { display: flex; flex-direction: column; gap: 12px; } .tl li { padding-left: 14px; border-left: 2px solid var(--c-border); } .tl strong { text-transform: capitalize; }`,
})
export class AdminApprovalsPage {
  private repo = inject(AdminRepository); private toast = inject(ToastService); private confirm = inject(ConfirmService);
  readonly res = rxResource({ stream: () => this.repo.applications() }); readonly tab = signal('pending'); readonly detail = signal<Application | null>(null);
  readonly tabs = computed(() => { const l = this.res.value() ?? []; const n = (s: string) => l.filter(a => (s === 'pending' ? a.status === 'pending' || a.status === 'needs_info' : a.status === s)).length; return [{ id: 'pending', label: 'To review', count: n('pending') }, { id: 'approved', label: 'Approved', count: n('approved') }, { id: 'rejected', label: 'Rejected', count: n('rejected') }]; });
  readonly list = computed(() => (this.res.value() ?? []).filter(a => (this.tab() === 'pending' ? a.status === 'pending' || a.status === 'needs_info' : a.status === this.tab())).sort((a, b) => a.submittedAt.localeCompare(b.submittedAt)));
  readonly ago = timeAgo; readonly dt = formatDateTime; readonly cat = (id: string) => CATEGORIES_BY_ID[id] ?? id;
  constructor() { inject(SeoService).set('Approvals'); }
  async act(a: Application, action: Action) {
    const c: Record<Action, { title: string; msg: string; btn: string; need: boolean; danger?: boolean }> = {
      approved: { title: `Approve ${a.displayName}?`, msg: 'Their profile becomes visible in search. This does not verify their identity.', btn: 'Approve', need: false },
      rejected: { title: `Reject ${a.displayName}?`, msg: 'They are notified with your reason and can resubmit.', btn: 'Reject', need: true, danger: true },
      info_requested: { title: 'Request more information', msg: 'They are notified with what to add.', btn: 'Send request', need: true },
      identity_verified: { title: `Mark ${a.displayName}’s identity as verified?`, msg: 'Only do this if you checked an official document outside this app. A public “Verified identity” badge will appear.', btn: 'Mark verified', need: true },
    };
    const o = c[action]; const r = await this.confirm.ask({ title: o.title, message: o.msg, confirmText: o.btn, danger: o.danger, reasonLabel: action === 'identity_verified' ? 'How was it verified? (internal)' : 'Note to the photographer', reasonRequired: o.need }); if (!r.ok) return;
    this.repo.decideApplication(a.photographerId, action, r.reason).subscribe({ next: () => { this.toast.success('Saved.'); this.res.reload(); }, error: e => this.toast.error(errorText(e)) });
  }
}
