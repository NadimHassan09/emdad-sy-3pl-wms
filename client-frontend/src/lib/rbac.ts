import type { ClientPortalRole } from '../types/auth';

export type ClientNavGroup = 'wms' | 'oms' | null;

export type ClientNavItem = {
  label: string;
  labelAr: string;
  iconKey: string;
  to: string;
  exact?: boolean;
  group?: ClientNavGroup;
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
    label: 'Inbound',
    labelAr: 'الوارد',
    iconKey: 'Orders',
    to: '/inbound-orders',
    group: 'wms',
    roles: ['client_admin', 'client_staff'],
  },
  {
    label: 'Outbound',
    labelAr: 'الصادر',
    iconKey: 'Orders',
    to: '/outbound-orders',
    group: 'wms',
    roles: ['client_admin', 'client_staff'],
  },
  {
    label: 'Products',
    labelAr: 'المنتجات',
    iconKey: 'Products',
    to: '/products',
    group: 'wms',
    roles: ['client_admin', 'client_staff'],
  },
  {
    label: 'OMS Orders',
    labelAr: 'طلبات OMS',
    iconKey: 'Orders',
    to: '/ecommerce-orders',
    group: 'oms',
    roles: ['client_admin', 'client_staff'],
  },
  {
    label: 'COD',
    labelAr: 'COD',
    iconKey: 'Billing',
    to: '/cod-reports',
    group: 'oms',
    roles: ['client_admin', 'client_staff'],
  },
  {
    label: 'Returns',
    labelAr: 'المرتجعات',
    iconKey: 'Orders',
    to: '/returns',
    group: 'oms',
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
  if (
    pathname.startsWith('/inbound-orders') ||
    pathname.startsWith('/outbound-orders') ||
    pathname.startsWith('/ecommerce-orders') ||
    pathname.startsWith('/cod-reports') ||
    pathname.startsWith('/returns')
  ) {
    return 'orders';
  }
  if (pathname.startsWith('/products')) return 'products';
  if (pathname.startsWith('/billing')) return 'billing';
  if (pathname.startsWith('/notifications')) return 'notifications';
  return 'other';
}

const ROUTE_GROUP_ROLES: Record<string, ClientPortalRole[]> = {
  home: ['client_admin', 'client_staff'],
  orders: ['client_admin', 'client_staff'],
  products: ['client_admin', 'client_staff'],
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
    if (group === 'billing') return '/dashboard';
  }
  return defaultClientHomePath();
}

export function clientNavForRole(role: ClientPortalRole | string | undefined): ClientNavItem[] {
  if (role !== 'client_admin' && role !== 'client_staff') return [];
  return NAV_CATALOG.filter((item) => item.roles.includes(role)).map(
    ({ label, labelAr, iconKey, to, exact, group }) => ({
      label,
      labelAr,
      iconKey,
      to,
      exact,
      group: group ?? null,
    }),
  );
}

export function isClientAdmin(role: ClientPortalRole | string | undefined): boolean {
  return role === 'client_admin';
}
