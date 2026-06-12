import type { ClientPortalRole } from '../types/auth';

export type ClientNavItem = {
  label: string;
  labelAr: string;
  iconKey: string;
  to: string;
  exact?: boolean;
};

const NAV_CATALOG: Array<ClientNavItem & { roles: ClientPortalRole[] }> = [
  {
    label: 'Dashboard',
    labelAr: 'لوحة التحكم',
    iconKey: 'Dashboard',
    to: '/dashboard',
    exact: true,
    roles: ['client_admin', 'client_staff'],
  },
  {
    label: 'Orders',
    labelAr: 'الطلبات',
    iconKey: 'Orders',
    to: '/inbound-orders',
    roles: ['client_admin', 'client_staff'],
  },
  {
    label: 'Products',
    labelAr: 'المنتجات',
    iconKey: 'Products',
    to: '/products',
    roles: ['client_admin'],
  },
  {
    label: 'Stock',
    labelAr: 'المخزون',
    iconKey: 'Stock',
    to: '/stock',
    roles: ['client_admin', 'client_staff'],
  },
  {
    label: 'Billing',
    labelAr: 'الفوترة',
    iconKey: 'Billing',
    to: '/billing',
    roles: ['client_admin'],
  },
  {
    label: 'Notifications',
    labelAr: 'الإشعارات',
    iconKey: 'Notifications',
    to: '/notifications',
    roles: ['client_admin', 'client_staff'],
  },
];

function routeGroup(pathname: string): string {
  if (pathname === '/dashboard' || pathname === '/') return 'home';
  if (pathname.startsWith('/inbound-orders') || pathname.startsWith('/outbound-orders')) return 'orders';
  if (pathname.startsWith('/products')) return 'products';
  if (pathname.startsWith('/stock')) return 'stock';
  if (pathname.startsWith('/billing')) return 'billing';
  if (pathname.startsWith('/notifications')) return 'notifications';
  return 'other';
}

const ROUTE_GROUP_ROLES: Record<string, ClientPortalRole[]> = {
  home: ['client_admin', 'client_staff'],
  orders: ['client_admin', 'client_staff'],
  products: ['client_admin'],
  stock: ['client_admin', 'client_staff'],
  billing: ['client_admin'],
  notifications: ['client_admin', 'client_staff'],
  other: ['client_admin', 'client_staff'],
};

export function canAccessClientPath(role: ClientPortalRole | string | undefined, pathname: string): boolean {
  if (role !== 'client_admin' && role !== 'client_staff') return false;
  const group = routeGroup(pathname);
  return (ROUTE_GROUP_ROLES[group] ?? ['client_admin', 'client_staff']).includes(role);
}

export function defaultClientHomePath(): string {
  return '/dashboard';
}

/** Where to send a user who opened a route their role cannot access. */
export function redirectPathForDeniedRoute(
  role: ClientPortalRole | string | undefined,
  pathname: string,
): string {
  if (role !== 'client_admin' && role !== 'client_staff') return defaultClientHomePath();
  const group = routeGroup(pathname);
  if (role === 'client_staff') {
    if (group === 'products') return '/stock';
    if (group === 'billing') return '/dashboard';
  }
  return defaultClientHomePath();
}

export function clientNavForRole(role: ClientPortalRole | string | undefined): ClientNavItem[] {
  if (role !== 'client_admin' && role !== 'client_staff') return [];
  return NAV_CATALOG.filter((item) => item.roles.includes(role)).map(({ label, labelAr, iconKey, to, exact }) => ({
    label,
    labelAr,
    iconKey,
    to,
    exact,
  }));
}

export function isClientAdmin(role: ClientPortalRole | string | undefined): boolean {
  return role === 'client_admin';
}
