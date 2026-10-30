import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { AvailabilityRepository, BookingRepository, CatalogRepository, ReviewRepository } from '../../core/api/repositories';
import { Booking, BookingStatus, ISODate, Role } from '../../core/models';
import { formatDate, formatDateTime, monthGrid, startOfMonth, todayISO, combine } from '../../core/util/dates';
import { errorText } from '../../core/util/forms';
import { formatMoney } from '../../core/util/price';
import { BadgeComponent, TierBadgeComponent } from '../ui/badges';
import { IconComponent } from '../ui/icon.component';
import { DayMark, MonthCalendarComponent } from '../ui/month-calendar.component';
import { StarsInputComponent } from '../ui/misc';
import { ConfirmService, ToastService } from '../services/overlay.services';

/** Booking details + every lifecycle action for the current role. All rules are re-validated by the (future) backend. */
@Component({
  selector: 'app-booking-detail',
  imports: [FormsModule, RouterLink, BadgeComponent, TierBadgeComponent, IconComponent, MonthCalendarComponent, StarsInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './booking-detail.component.html',
  styleUrl: './booking-detail.component.scss',
})
export class BookingDetailComponent {
  readonly booking = input.required<Booking>(); readonly role = input.required<Role>(); readonly changed = output<Booking>();
  private repo = inject(BookingRepository); private avail = inject(AvailabilityRepository); private catalog = inject(CatalogRepository); private reviews = inject(ReviewRepository);
  private confirm = inject(ConfirmService); private toast = inject(ToastService);
  readonly busy = signal(false); readonly panel = signal<'none' | 'reschedule' | 'review' | 'dispute'>('none');
  readonly month = signal<ISODate>(startOfMonth(todayISO())); readonly day = signal<ISODate | null>(null); readonly slot = signal<string | null>(null);
  readonly rating = signal(5); readonly comment = signal(''); readonly reason = signal('');
  readonly money = (n: number) => formatMoney(n, 'MAD'); readonly fmt = (d: ISODate) => formatDate(d); readonly when = formatDateTime;

  readonly b = computed(() => this.booking());
  readonly isPast = computed(() => this.b().date <= todayISO());
  readonly active = computed(() => this.b().status === 'pending' || this.b().status === 'confirmed');
  readonly isClient = computed(() => this.role() === 'client'); readonly isPhotog = computed(() => this.role() === 'photographer'); readonly isAdmin = computed(() => this.role() === 'admin');
  readonly policy = rxResource({ params: () => (this.active() && !this.isAdmin() ? this.b().photographerId : null), stream: ({ params }) => (params ? this.catalog.photographer(params) : of(null)) });
  readonly hoursLeft = computed(() => (combine(this.b().date, this.b().startTime).getTime() - Date.now()) / 3600_000);
  readonly refundEstimate = computed(() => { const p = this.policy.value()?.cancellationPolicy; if (!p || !this.isClient()) return null; if (this.b().status === 'pending') return 100; const h = this.hoursLeft(); return h >= p.freeCancelHours ? 100 : h >= p.partialRefundHours ? p.partialRefundPercent : 0; });

  readonly open = rxResource({ params: () => (this.panel() === 'reschedule' ? { id: this.b().photographerId, month: this.month(), dur: this.b().durationMinutes } : null), stream: ({ params }) => (params ? this.avail.openDays(params.id, monthGrid(params.month), params.dur) : of([] as ISODate[])) });
  readonly slots = rxResource({ params: () => (this.panel() === 'reschedule' && this.day() ? { id: this.b().photographerId, day: this.day()!, dur: this.b().durationMinutes } : null), stream: ({ params }) => (params ? this.avail.slots(params.id, params.day, params.dur) : of([])) });
  readonly marks = computed<Record<ISODate, DayMark>>(() => Object.fromEntries((this.open.value() ?? []).map(d => [d, { tone: 'success' as const }])));
  readonly disabledDay = computed(() => { const o = new Set(this.open.value() ?? []); return (d: ISODate) => !o.has(d); });
  readonly freeSlots = computed(() => (this.slots.value() ?? []).filter(s => s.available));

  readonly steps = computed(() => {
    const b = this.b(); const done = ['requested', ...b.history.map(h => h.type)];
    const base: { key: string; label: string; state: 'done' | 'current' | 'todo' | 'bad' }[] = [{ key: 'requested', label: 'Request sent', state: 'done' }];
    if (b.status === 'rejected' || b.status === 'expired' || b.status === 'cancelled') { base.push({ key: b.status, label: b.status === 'rejected' ? 'Declined by photographer' : b.status === 'expired' ? 'Request expired' : 'Cancelled', state: 'bad' }); return base; }
    base.push({ key: 'confirmed', label: 'Confirmed by photographer', state: b.status === 'pending' ? 'current' : 'done' });
    base.push({ key: 'completed', label: 'Session completed', state: b.status === 'completed' ? 'done' : b.status === 'confirmed' ? 'current' : 'todo' });
    base.push({ key: 'delivered', label: 'Gallery delivered', state: b.deliveryStatus === 'delivered' ? 'done' : b.status === 'completed' ? 'current' : 'todo' });
    void done; return base;
  });

  private run(obs: ReturnType<BookingRepository['cancel']>, ok: string, after?: () => void) {
    this.busy.set(true);
    obs.subscribe({ next: nb => { this.busy.set(false); this.toast.success(ok); this.panel.set('none'); after?.(); this.changed.emit(nb); }, error: e => { this.busy.set(false); this.toast.error(errorText(e)); this.slots.reload(); } });
  }
  async setStatus(status: BookingStatus) {
    if (status === 'rejected') { const r = await this.confirm.ask({ title: 'Decline this request?', message: 'The customer will be notified.', confirmText: 'Decline', danger: true, reasonLabel: 'Reason (shared with the customer)', reasonRequired: true }); if (!r.ok) return; this.run(this.repo.setStatus(this.b().id, status, r.reason), 'Request declined.'); return; }
    this.run(this.repo.setStatus(this.b().id, status), status === 'confirmed' ? 'Booking confirmed.' : 'Marked as completed.');
  }
  async cancel() {
    const est = this.refundEstimate(); const r = await this.confirm.ask({ title: 'Cancel this booking?', message: this.isClient() ? (est == null ? 'The photographer’s policy will apply.' : `Based on the photographer's policy you would be eligible for about ${est}% refund (if anything was paid). The server applies the final amount.`) : 'The customer will be notified and refunded in full.', confirmText: 'Cancel booking', danger: true, reasonLabel: 'Reason', reasonRequired: true });
    if (r.ok) this.run(this.repo.cancel(this.b().id, r.reason), 'Booking cancelled.');
  }
  sendReschedule() { const d = this.day(), s = this.slot(); if (d && s) this.run(this.repo.requestReschedule(this.b().id, d, s), 'Reschedule request sent.'); }
  respond(accept: boolean) { this.run(this.repo.respondReschedule(this.b().id, accept), accept ? 'New time confirmed.' : 'Reschedule declined.'); }
  setDelivery(v: string) { this.run(this.repo.setDelivery(this.b().id, v as Booking['deliveryStatus']), 'Delivery status updated.'); }
  submitReview() { this.busy.set(true); this.reviews.submit(this.b().id, this.rating(), this.comment()).subscribe({ next: () => { this.busy.set(false); this.toast.success('Thanks for your review!'); this.panel.set('none'); this.repo.get(this.b().id).subscribe(nb => this.changed.emit(nb)); }, error: e => { this.busy.set(false); this.toast.error(errorText(e)); } }); }
  submitDispute() { this.run(this.repo.openDispute(this.b().id, this.reason()), 'Dispute opened — our team will review it.'); }
  async resolve() { const r = await this.confirm.ask({ title: 'Resolve dispute', message: 'Record the outcome. This is stored in the audit log.', confirmText: 'Resolve', reasonLabel: 'Resolution', reasonRequired: true }); if (r.ok) this.run(this.repo.resolveDispute(this.b().id, r.reason), 'Dispute resolved.'); }
  async refund(kind: 'refunded' | 'partially_refunded') { const r = await this.confirm.ask({ title: kind === 'refunded' ? 'Record full refund?' : 'Record partial refund?', message: 'This records that a refund was issued. It does not move money in this prototype.', confirmText: 'Record refund', danger: true }); if (r.ok) this.run(this.repo.markRefund(this.b().id, kind), 'Refund recorded.'); }
}
