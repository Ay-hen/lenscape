import { Routes } from '@angular/router';

export const STUDIO_ROUTES: Routes = [{
  path: '',
  loadComponent: () => import('../../layouts/dashboard-shell.component').then(m => m.DashboardShellComponent),
  data: { area: 'studio' },
  children: [
    { path: '', pathMatch: 'full', title: 'Studio dashboard', loadComponent: () => import('./dashboard.page').then(m => m.StudioDashboardPage) },
    { path: 'onboarding', title: 'Studio setup', data: { onboarding: true }, loadComponent: () => import('./profile.page').then(m => m.StudioProfilePage) },
    { path: 'profile', title: 'Profile & location', loadComponent: () => import('./profile.page').then(m => m.StudioProfilePage) },
    { path: 'bookings', title: 'Bookings', loadComponent: () => import('../../shared/pages/bookings.page').then(m => m.BookingsPage) },
    { path: 'calendar', title: 'Calendar', loadComponent: () => import('./calendar.page').then(m => m.StudioCalendarPage) },
    { path: 'availability', title: 'Availability', loadComponent: () => import('./availability.page').then(m => m.StudioAvailabilityPage) },
    { path: 'services', title: 'Services', loadComponent: () => import('./services.page').then(m => m.StudioServicesPage) },
    { path: 'services/new', title: 'New service', loadComponent: () => import('./service-wizard.page').then(m => m.ServiceWizardPage) },
    { path: 'services/:id', title: 'Edit service', loadComponent: () => import('./service-wizard.page').then(m => m.ServiceWizardPage) },
    { path: 'packages', title: 'Packages', loadComponent: () => import('./packages.page').then(m => m.StudioPackagesPage) },
    { path: 'portfolio', title: 'Portfolio', loadComponent: () => import('./portfolio.page').then(m => m.StudioPortfolioPage) },
    { path: 'automation', title: 'Automation', loadComponent: () => import('./automation.page').then(m => m.StudioAutomationPage) },
    { path: 'finance', title: 'Finance', loadComponent: () => import('./finance.page').then(m => m.StudioFinancePage) },
    { path: 'messages', title: 'Messages', loadComponent: () => import('../../shared/pages/messages.page').then(m => m.MessagesPage) },
    { path: 'notifications', title: 'Notifications', loadComponent: () => import('../../shared/pages/notifications.page').then(m => m.NotificationsPage) },
  ],
}];
