import { Routes } from '@angular/router';
import { guestGuard, roleGuard } from './core/auth/guards';

/**
 * Role areas are lazy-loaded. Guards only improve UX — the backend must authorise every API call.
 * Photographer and admin routes are appended in their own files to keep this table readable.
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layouts/public-shell.component').then(m => m.PublicShellComponent),
    children: [
      { path: '', pathMatch: 'full', title: 'Lenscape', loadComponent: () => import('./features/home/home.page').then(m => m.HomePage) },
      { path: 'discover', loadComponent: () => import('./features/discover/discover.page').then(m => m.DiscoverPage) },
      { path: 'photographers/:id', loadComponent: () => import('./features/profile/profile.page').then(m => m.ProfilePage) },
      { path: 'book/:id', canActivate: [roleGuard('client')], loadComponent: () => import('./features/booking/booking.page').then(m => m.BookingPage) },
      { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./features/auth/login.page').then(m => m.LoginPage) },
      { path: 'verify-email', canActivate: [guestGuard], loadComponent: () => import('./features/auth/verify-email.page').then(m => m.VerifyEmailPage) },
      { path: 'register', canActivate: [guestGuard], loadComponent: () => import('./features/auth/register.page').then(m => m.RegisterPage), data: { mode: 'customer' } },
      { path: 'register/photographer', canActivate: [guestGuard], loadComponent: () => import('./features/auth/register.page').then(m => m.RegisterPage), data: { mode: 'photographer' } },
    ],
  },
  {
    path: 'account',
    canActivate: [roleGuard('client')], canActivateChild: [roleGuard('client')],
    data: { area: 'account' },
    loadComponent: () => import('./layouts/dashboard-shell.component').then(m => m.DashboardShellComponent),
    children: [
      { path: '', pathMatch: 'full', loadComponent: () => import('./features/account/account-overview.page').then(m => m.AccountOverviewPage) },
      { path: 'bookings', loadComponent: () => import('./shared/pages/bookings.page').then(m => m.BookingsPage) },
      { path: 'favorites', loadComponent: () => import('./features/account/favorites.page').then(m => m.FavoritesPage) },
      { path: 'messages', loadComponent: () => import('./shared/pages/messages.page').then(m => m.MessagesPage) },
      { path: 'notifications', loadComponent: () => import('./shared/pages/notifications.page').then(m => m.NotificationsPage) },
      { path: 'settings', loadComponent: () => import('./features/account/settings.page').then(m => m.AccountSettingsPage) },
    ],
  },
  { path: 'studio', canActivate: [roleGuard('photographer')], data: { area: 'studio' }, loadChildren: () => import('./features/studio/studio.routes').then(m => m.STUDIO_ROUTES) },
  { path: 'admin', canActivate: [roleGuard('admin')], data: { area: 'admin' }, loadChildren: () => import('./features/admin/admin.routes').then(m => m.ADMIN_ROUTES) },
  { path: '**', title: 'Not found', loadComponent: () => import('./features/not-found.page').then(m => m.NotFoundPage) },
];
