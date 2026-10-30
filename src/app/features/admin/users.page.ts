import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AdminRepository } from '../../core/api/repositories';
import { User } from '../../core/models';
import { formatDateTime, timeAgo } from '../../core/util/dates';
import { errorText } from '../../core/util/forms';
import { SeoService } from '../../core/seo.service';
import { AvatarComponent, EmptyStateComponent, ErrorStateComponent, PageHeaderComponent, PaginationComponent } from '../../shared/ui/misc';
import { BadgeComponent } from '../../shared/ui/badges';
import { ModalComponent } from '../../shared/ui/modal.component';
import { ConfirmService, ToastService } from '../../shared/services/overlay.services';

@Component({
  selector: 'app-admin-users',
  imports: [AvatarComponent, BadgeComponent, EmptyStateComponent, ErrorStateComponent, ModalComponent, PageHeaderComponent, PaginationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <app-page-header title="Users" subtitle="Customers, photographers and admins. Suspending blocks sign-in on the backend; here it updates the account record." />
  <div class="filters card card--pad"><input class="input" type="search" placeholder="Search name, email, username or city" aria-label="Search users" (input)="search($any($event.target).value)" />
    <select class="select" aria-label="Role" (change)="role.set($any($event.target).value); page.set(1)"><option value="all">All roles</option><option value="client">Customers</option><option value="photographer">Photographers</option><option value="admin">Admins</option></select>
    <select class="select" aria-label="Status" (change)="status.set($any($event.target).value); page.set(1)"><option value="all">Any status</option><option value="active">Active</option><option value="pending">Pending</option><option value="suspended">Suspended</option></select></div>
  @if (res.error()) { <app-error-state [error]="res.error()" (retry)="res.reload()" /> }
  @else if (!res.value()) { <div class="skeleton" style="height: 320px; margin-top: 16px"></div> }
  @else if (!res.value()!.items.length) { <app-empty-state icon="users" title="No users match" text="Try a different search or filter." /> }
  @else { <div class="card tw"><table class="table"><caption class="sr-only">Users</caption><thead><tr><th>User</th><th>Role</th><th>City</th><th>Status</th><th>Last active</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>
    @for (u of res.value()!.items; track u.id) { <tr><td><div class="who"><app-avatar [src]="u.avatarUrl ?? ''" [alt]="u.name" [size]="34" /><div><strong>{{ u.name }}</strong><div class="muted xs">{{ u.email }}</div></div></div></td><td>{{ roleName(u.role) }}</td><td>{{ u.city || '—' }}</td><td><app-badge [status]="u.status" /></td><td class="muted small">{{ u.lastActiveAt ? ago(u.lastActiveAt) : '—' }}</td>
      <td class="acts"><button class="btn btn--sm btn--ghost" type="button" (click)="view.set(u)">Details</button>
        @if (u.role !== 'admin') { @if (u.status === 'suspended') { <button class="btn btn--sm btn--outline" type="button" (click)="reactivate(u)">Reactivate</button> } @else { <button class="btn btn--sm btn--ghost danger" type="button" (click)="suspend(u)">Suspend</button> } }</td></tr> }</tbody></table></div>
    <app-pagination [page]="page()" [pageSize]="size" [total]="res.value()!.total" (pageChange)="page.set($event)" /> }
  <app-modal [open]="!!view()" label="User details" (closed)="view.set(null)">@if (view(); as u) { <div class="dt"><app-avatar [src]="u.avatarUrl ?? ''" [alt]="u.name" [size]="64" /><h2>{{ u.name }}</h2><dl><dt>Role</dt><dd>{{ roleName(u.role) }}</dd><dt>Username</dt><dd>{{ u.username }}</dd><dt>Email</dt><dd>{{ u.email }}</dd><dt>Phone</dt><dd>{{ u.phone || '—' }}</dd><dt>City</dt><dd>{{ u.city || '—' }}</dd><dt>Status</dt><dd><app-badge [status]="u.status" /></dd><dt>Joined</dt><dd>{{ dt(u.createdAt) }}</dd><dt>Last active</dt><dd>{{ u.lastActiveAt ? dt(u.lastActiveAt) : '—' }}</dd></dl></div> }</app-modal>`,
  styles: `.filters { display: grid; grid-template-columns: 1fr 180px 180px; gap: 10px; margin-bottom: 16px; } @media (max-width: 700px) { .filters { grid-template-columns: minmax(0, 1fr); } } .tw { overflow-x: auto; } .who { display: flex; gap: 10px; align-items: center; } .acts { white-space: nowrap; text-align: right; } .danger { color: var(--c-error); } .dt { padding: 28px; display: flex; flex-direction: column; gap: 10px; align-items: flex-start; } h2 { font-size: 1.4rem; } dl { display: grid; grid-template-columns: 110px 1fr; gap: 8px 14px; width: 100%; } dt { color: var(--c-text-muted); }`,
})
export class AdminUsersPage {
  private repo = inject(AdminRepository); private toast = inject(ToastService); private confirm = inject(ConfirmService);
  readonly q = signal(''); readonly role = signal('all'); readonly status = signal('all'); readonly page = signal(1); readonly size = 12; readonly view = signal<User | null>(null);
  readonly res = rxResource({
    params: () => ({ q: this.q(), role: this.role() as User['role'] | 'all', status: this.status() as User['status'] | 'all', page: this.page() }),
    stream: ({ params }) => this.repo.users({ q: params.q, role: params.role, status: params.status, page: params.page, pageSize: this.size }),
  });
  private t?: ReturnType<typeof setTimeout>; readonly ago = timeAgo; readonly dt = formatDateTime;
  constructor() { inject(SeoService).set('Users'); }
  roleName(r: User['role']) { return r === 'client' ? 'Customer' : r === 'photographer' ? 'Photographer' : 'Admin'; }
  search(v: string) { clearTimeout(this.t); this.t = setTimeout(() => { this.q.set(v.trim()); this.page.set(1); }, 250); }
  async suspend(u: User) {
    const r = await this.confirm.ask({ title: `Suspend ${u.name}?`, message: 'They will not be able to sign in or receive new bookings. This is recorded in the audit log.', confirmText: 'Suspend', danger: true, reasonLabel: 'Reason (internal)', reasonRequired: true }); if (!r.ok) return;
    this.repo.setUserStatus(u.id, 'suspended', r.reason).subscribe({ next: () => { this.toast.success('Account suspended.'); this.res.reload(); }, error: e => this.toast.error(errorText(e)) });
  }
  async reactivate(u: User) {
    const r = await this.confirm.ask({ title: `Reactivate ${u.name}?`, confirmText: 'Reactivate', reasonLabel: 'Note (internal)' }); if (!r.ok) return;
    this.repo.setUserStatus(u.id, 'active', r.reason).subscribe({ next: () => { this.toast.success('Account reactivated.'); this.res.reload(); }, error: e => this.toast.error(errorText(e)) });
  }
}
