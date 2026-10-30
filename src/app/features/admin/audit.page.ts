import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AdminRepository } from '../../core/api/repositories';
import { formatDateTime, todayISO } from '../../core/util/dates';
import { SeoService } from '../../core/seo.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { EmptyStateComponent, ErrorStateComponent, PageHeaderComponent, PaginationComponent } from '../../shared/ui/misc';
import { ToastService } from '../../shared/services/overlay.services';

const csvCell = (v: string) => { let s = v; if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

@Component({
  selector: 'app-admin-audit',
  imports: [IconComponent, EmptyStateComponent, ErrorStateComponent, PageHeaderComponent, PaginationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <app-page-header title="Audit log" subtitle="Sensitive admin actions. In production this log must be written by the server so it cannot be edited from a browser.">
    <button class="btn btn--outline" type="button" [disabled]="!rows().length" (click)="csv()"><app-icon name="download" [size]="16" />Export CSV</button></app-page-header>
  <div class="card card--pad f"><input class="input" type="search" placeholder="Search actor, action or target" aria-label="Search audit log" (input)="q.set($any($event.target).value.toLowerCase()); page.set(1)" />
    <select class="select" aria-label="Actor" (change)="actor.set($any($event.target).value); page.set(1)"><option value="">All actors</option>@for (a of actors(); track a) { <option [value]="a">{{ a }}</option> }</select></div>
  @if (res.error()) { <app-error-state [error]="res.error()" (retry)="res.reload()" /> }
  @else if (!res.value()) { <div class="skeleton" style="height: 280px"></div> }
  @else if (!rows().length) { <app-empty-state icon="scroll-text" title="No entries" text="No audit entries match." /> }
  @else { <div class="card tw"><table class="table"><caption class="sr-only">Audit log</caption><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Detail</th></tr></thead><tbody>
    @for (a of paged(); track a.id) { <tr><td class="nw">{{ dt(a.at) }}</td><td>{{ a.actor }}</td><td>{{ a.action }}</td><td>{{ a.target }}</td><td class="muted small">{{ a.detail || '—' }}</td></tr> }</tbody></table></div>
    <app-pagination [page]="page()" [pageSize]="size" [total]="rows().length" (pageChange)="page.set($event)" /> }`,
  styles: `.f { display: grid; grid-template-columns: 1fr 220px; gap: 10px; margin-bottom: 16px; } @media (max-width: 640px) { .f { grid-template-columns: minmax(0, 1fr); } } .tw { overflow-x: auto; } .nw { white-space: nowrap; }`,
})
export class AdminAuditPage {
  private toast = inject(ToastService);
  private repo = inject(AdminRepository);
  readonly res = rxResource({ stream: () => this.repo.audit() }); readonly q = signal(''); readonly actor = signal(''); readonly page = signal(1); readonly size = 15; readonly dt = formatDateTime;
  readonly actors = computed(() => [...new Set((this.res.value() ?? []).map(a => a.actor))].sort());
  readonly rows = computed(() => (this.res.value() ?? []).filter(a => (!this.actor() || a.actor === this.actor()) && (!this.q() || [a.actor, a.action, a.target, a.detail ?? ''].join(' ').toLowerCase().includes(this.q()))).sort((a, b) => b.at.localeCompare(a.at)));
  readonly paged = computed(() => this.rows().slice((this.page() - 1) * this.size, this.page() * this.size));
  constructor() { inject(SeoService).set('Audit log'); }
  csv() {
    const lines = [['When', 'Actor', 'Action', 'Target', 'Detail'], ...this.rows().map(a => [a.at, a.actor, a.action, a.target, a.detail ?? ''])].map(r => r.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + lines], { type: 'text/csv;charset=utf-8' })); const el = document.createElement('a'); el.href = url; el.download = `audit-log-${todayISO()}.csv`; el.click(); URL.revokeObjectURL(url); this.toast.success('CSV downloaded.');
  }
}
