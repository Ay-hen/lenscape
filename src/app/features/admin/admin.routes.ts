import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [{
  path: '',
  loadComponent: () => import('../../layouts/dashboard-shell.component').then(m => m.DashboardShellComponent),
  data: { area: 'admin' },
  children: [
    { path: '', pathMatch: 'full', title: 'Admin overview', loadComponent: () => import('./overview.page').then(m => m.AdminOverviewPage) },
    { path: 'analytics', title: 'Analytics', loadComponent: () => import('./analytics.page').then(m => m.AdminAnalyticsPage) },
    { path: 'users', title: 'Users', loadComponent: () => import('./users.page').then(m => m.AdminUsersPage) },
    { path: 'approvals', title: 'Approvals', loadComponent: () => import('./approvals.page').then(m => m.AdminApprovalsPage) },
    { path: 'bookings', title: 'Bookings & disputes', loadComponent: () => import('./bookings.page').then(m => m.AdminBookingsPage) },
    { path: 'moderation', title: 'Moderation', loadComponent: () => import('./moderation.page').then(m => m.AdminModerationPage) },
    { path: 'audit', title: 'Audit log', loadComponent: () => import('./audit.page').then(m => m.AdminAuditPage) },
    { path: 'settings', title: 'Settings', loadComponent: () => import('./settings.page').then(m => m.AdminSettingsPage) },
  ],
}];
