import { Role } from '../core/models';

export interface NavItem { label: string; icon: string; link: string; exact?: boolean; badge?: 'messages' | 'notifications' }
export interface NavArea { title: string; role: Role; items: NavItem[]; groups?: { heading: string; items: NavItem[] }[] }

export const AREAS: Record<'account' | 'studio' | 'admin', NavArea> = {
  account: { title: 'My account', role: 'client', items: [], groups: [
    { heading: 'Overview', items: [
      { label: 'Dashboard', icon: 'layout-dashboard', link: '/account', exact: true },
      { label: 'Bookings', icon: 'calendar-check', link: '/account/bookings' },
      { label: 'Favourites', icon: 'heart', link: '/account/favorites' },
      { label: 'Messages', icon: 'message', link: '/account/messages', badge: 'messages' },
      { label: 'Notifications', icon: 'bell', link: '/account/notifications', badge: 'notifications' },
    ] },
    { heading: 'Account', items: [{ label: 'Profile & settings', icon: 'settings', link: '/account/settings' }] },
  ] },
  studio: { title: 'Photographer studio', role: 'photographer', items: [], groups: [
    { heading: 'Business', items: [
      { label: 'Dashboard', icon: 'layout-dashboard', link: '/studio', exact: true },
      { label: 'Bookings', icon: 'calendar-check', link: '/studio/bookings' },
      { label: 'Calendar', icon: 'calendar', link: '/studio/calendar' },
      { label: 'Messages', icon: 'message', link: '/studio/messages', badge: 'messages' },
      { label: 'Finance', icon: 'wallet', link: '/studio/finance' },
    ] },
    { heading: 'Storefront', items: [
      { label: 'Profile & location', icon: 'map-pin', link: '/studio/profile' },
      { label: 'Services', icon: 'camera', link: '/studio/services' },
      { label: 'Packages', icon: 'layers', link: '/studio/packages' },
      { label: 'Portfolio', icon: 'image', link: '/studio/portfolio' },
    ] },
    { heading: 'Growth', items: [
      { label: 'Automation', icon: 'zap', link: '/studio/automation' },
      { label: 'Availability', icon: 'clock', link: '/studio/availability' },
      { label: 'Notifications', icon: 'bell', link: '/studio/notifications', badge: 'notifications' },
    ] },
  ] },
  admin: { title: 'Administration', role: 'admin', items: [], groups: [
    { heading: 'Platform', items: [
      { label: 'Overview', icon: 'layout-dashboard', link: '/admin', exact: true },
      { label: 'Reports & analytics', icon: 'bar-chart', link: '/admin/analytics' },
    ] },
    { heading: 'People', items: [
      { label: 'Users', icon: 'users', link: '/admin/users' },
    ] },
    { heading: 'Marketplace', items: [
      { label: 'Bookings & disputes', icon: 'calendar-check', link: '/admin/bookings' },
      { label: 'Listings moderation', icon: 'shield-alert', link: '/admin/moderation' },
      { label: 'Audit log', icon: 'scroll-text', link: '/admin/audit' },
      { label: 'Settings', icon: 'settings', link: '/admin/settings' },
    ] },
  ] },
};
