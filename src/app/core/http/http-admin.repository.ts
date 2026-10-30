import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AdminRepository, AnalyticsBundle, AnalyticsRepository, PhotographerAnalytics } from '../api/repositories';
import { AdminOverview, Application, AuditEntry, ContentReport, DateRange, Page, PageQuery, PlatformSettings, Service, ServicePackage, User } from '../models';
import { useApi } from './api';
import { toParams, withApplicationMedia } from './http-util';

const enc = encodeURIComponent;

/** /admin/** and POST /reports. Every call is authorised on the server (role "admin"); the UI guard is only a convenience. */
@Injectable()
export class HttpAdminRepository extends AdminRepository {
  private api = useApi();
  override overview(): Observable<AdminOverview> { return this.api.get<AdminOverview>('/admin/overview'); }
  override users(q: PageQuery & { role?: User['role'] | 'all'; status?: User['status'] | 'all' }): Observable<Page<User>> {
    return this.api.get<Page<User>>('/admin/users', toParams({ role: q.role, status: q.status, q: q.q, sort: q.sort, dir: q.dir, page: q.page, pageSize: q.pageSize }));
  }
  override setUserStatus(id: string, status: User['status'], reason?: string): Observable<User> { return this.api.patch<User>(`/admin/users/${enc(id)}/status`, { status, reason }); }
  override applications(): Observable<Application[]> { return this.api.get<Application[]>('/admin/applications').pipe(map(l => l.map(withApplicationMedia))); }
  override decideApplication(photographerId: string, action: 'approved' | 'rejected' | 'info_requested' | 'identity_verified', note: string): Observable<Application> {
    return this.api.post<Application>(`/admin/applications/${enc(photographerId)}/decision`, { action, note }).pipe(map(withApplicationMedia));
  }
  override allServices(): Observable<Service[]> { return this.api.get<Service[]>('/admin/services'); }
  override allPackages(): Observable<ServicePackage[]> { return this.api.get<ServicePackage[]>('/admin/packages'); }
  override moderateService(id: string, state: Service['moderation'], featured?: boolean): Observable<Service> { return this.api.patch<Service>(`/admin/services/${enc(id)}/moderation`, { state, featured }); }
  override reports(): Observable<ContentReport[]> { return this.api.get<ContentReport[]>('/admin/reports'); }
  override resolveReport(id: string, state: ContentReport['state']): Observable<ContentReport> { return this.api.patch<ContentReport>(`/admin/reports/${enc(id)}`, { state }); }
  override report(targetType: ContentReport['targetType'], targetId: string, targetLabel: string, reason: string): Observable<void> {
    return this.api.post<void>('/reports', { targetType, targetId, targetLabel, reason });
  }
  override audit(): Observable<AuditEntry[]> { return this.api.get<AuditEntry[]>('/admin/audit'); }
  override settings(): Observable<PlatformSettings> { return this.api.get<PlatformSettings>('/admin/settings'); }
  override saveSettings(s: PlatformSettings): Observable<PlatformSettings> { return this.api.put<PlatformSettings>('/admin/settings', s); }
}

@Injectable()
export class HttpAnalyticsRepository extends AnalyticsRepository {
  private api = useApi();
  override platform(range: DateRange): Observable<AnalyticsBundle> { return this.api.get<AnalyticsBundle>('/analytics/platform', toParams({ from: range.from, to: range.to })); }
  override photographer(photographerId: string, range: DateRange): Observable<PhotographerAnalytics> {
    return this.api.get<PhotographerAnalytics>(`/analytics/photographers/${enc(photographerId)}`, toParams({ from: range.from, to: range.to }));
  }
}
