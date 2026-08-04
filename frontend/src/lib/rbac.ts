import { isOmsCodReturnsPath, isOmsCodReturnsUiEnabled } from './oms-cod-returns-ui';

/** Internal WMS roles (matches Prisma `UserRole` for warehouse staff). */
export type InternalRole = 'super_admin' | 'wh_manager' | 'wh_operator' | 'finance';

export type NavGroup = 'wms' | 'oms' | null;

export type NavItemDef = {
  labelKey: string;
  iconKey: string;
  to: string;
  match: (pathname: string) => boolean;
  group?: NavGroup;
};

const ALL_ROLES: InternalRole[] = ['super_admin', 'wh_manager', 'wh_operator', 'finance'];

/** Matches backend `InternalAdminGuard` — inventory internal-transfer, management mutations. */
export const INTERNAL_TRANSFER_ROLES: InternalRole[] = ['super_admin', 'wh_manager'];

const NAV_CATALOG: Array<NavItemDef & { roles: InternalRole[] }> = [
  {
    labelKey: 'Dashboard',
    iconKey: 'Dashboard',
    to: '/dashboard/overview',
    match: (p) => p === '/dashboard' || p.startsWith('/dashboard/'),
    roles: ['super_admin', 'wh_manager', 'finance'],
  },
  // ── WMS group ──
  {
    labelKey: 'Inbound',
    iconKey: 'Orders',
    to: '/orders/inbound',
    match: (p) => p.startsWith('/orders/inbound'),
    group: 'wms',
    roles: ['super_admin', 'wh_manager', 'finance'],
  },
  {
    labelKey: 'Outbound',
    iconKey: 'Orders',
    to: '/orders/outbound',
    match: (p) => p.startsWith('/orders/outbound'),
    group: 'wms',
    roles: ['super_admin', 'wh_manager', 'finance'],
  },
  {
    labelKey: 'Inventory',
    iconKey: 'Inventory',
    to: '/inventory/stock',
    match: (p) => p.startsWith('/inventory') || p === '/adjustments',
    group: 'wms',
    roles: ['super_admin', 'wh_manager', 'finance'],
  },
  {
    labelKey: 'Tasks',
    iconKey: 'Tasks',
    to: '/tasks',
    match: (p) => p.startsWith('/tasks') || p === '/internal',
    group: 'wms',
    roles: ['super_admin', 'wh_manager', 'wh_operator'],
  },
  {
    labelKey: 'Cycle count',
    iconKey: 'Inventory',
    to: '/cycle-count',
    match: (p) => p.startsWith('/cycle-count'),
    group: 'wms',
    roles: ['super_admin', 'wh_manager', 'wh_operator'],
  },
  {
    labelKey: 'Returns',
    iconKey: 'Orders',
    to: '/returns',
    match: (p) => p.startsWith('/returns'),
    group: 'wms',
    roles: ['super_admin', 'wh_manager', 'wh_operator'],
  },
  {
    labelKey: 'Products',
    iconKey: 'Products',
    to: '/products',
    match: (p) => p.startsWith('/products'),
    group: 'wms',
    roles: ['super_admin', 'wh_manager'],
  },
  {
    labelKey: 'Locations',
    iconKey: 'Locations',
    to: '/locations',
    match: (p) => p.startsWith('/locations'),
    group: 'wms',
    roles: ['super_admin', 'wh_manager'],
  },
  {
    labelKey: 'Warehouses',
    iconKey: 'Warehouses',
    to: '/warehouses',
    match: (p) => p.startsWith('/warehouses'),
    group: 'wms',
    roles: ['super_admin', 'wh_manager'],
  },
  // ── OMS group ──
  {
    labelKey: 'OMS Dashboard',
    iconKey: 'Dashboard',
    to: '/oms/dashboard',
    match: (p) => p === '/oms/dashboard' || p === '/oms',
    group: 'oms',
    roles: ['super_admin', 'wh_manager', 'finance'],
  },
  {
    labelKey: 'OMS Orders',
    iconKey: 'Orders',
    to: '/orders/oms',
    match: (p) => p.startsWith('/orders/oms') || p.startsWith('/oms/orders'),
    group: 'oms',
    roles: ['super_admin', 'wh_manager', 'finance'],
  },
  {
    labelKey: 'COD',
    iconKey: 'Reports',
    to: '/oms/cod',
    match: (p) => p === '/oms/cod' || p.startsWith('/oms/cod/'),
    group: 'oms',
    roles: ['super_admin', 'wh_manager', 'finance'],
  },
  {
    labelKey: 'OMS Returns',
    iconKey: 'Orders',
    to: '/oms/returns',
    match: (p) => p === '/oms/returns' || p.startsWith('/oms/returns/'),
    group: 'oms',
    roles: ['super_admin', 'wh_manager', 'finance'],
  },
  {
    labelKey: 'Contracts',
    iconKey: 'Forms',
    to: '/contracts/grn',
    match: (p) => p.startsWith('/contracts'),
    roles: ['super_admin', 'wh_manager', 'wh_operator', 'finance'],
  },
  {
    labelKey: 'Reports',
    iconKey: 'Reports',
    to: '/reports',
    match: (p) => p.startsWith('/reports') && !p.startsWith('/reports/oms'),
    roles: ['super_admin', 'wh_manager', 'finance'],
  },
  {
    labelKey: 'Clients',
    iconKey: 'Customers',
    to: '/clients',
    match: (p) => p.startsWith('/clients'),
    roles: ['super_admin', 'wh_manager'],
  },
  {
    labelKey: 'Forms',
    iconKey: 'Forms',
    to: '/forms',
    match: (p) => p.startsWith('/forms'),
    roles: ['super_admin', 'wh_manager'],
  },
  {
    labelKey: 'Billing',
    iconKey: 'Reports',
    to: '/billing/plans',
    match: (p) => p.startsWith('/billing'),
    roles: ['super_admin', 'wh_manager', 'finance'],
  },
  {
    labelKey: 'Users',
    iconKey: 'Users',
    to: '/users/warehouse_users',
    match: (p) => p.startsWith('/users'),
    roles: ['super_admin', 'wh_manager'],
  },
  {
    labelKey: 'Audit logs',
    iconKey: 'AuditLogs',
    to: '/audit-logs',
    match: (p) => p.startsWith('/audit-logs'),
    roles: ['super_admin', 'wh_manager', 'finance'],
  },
  {
    labelKey: 'Notifications',
    iconKey: 'Notifications',
    to: '/notifications',
    match: (p) => p.startsWith('/notifications'),
    roles: ALL_ROLES,
  },
  {
    labelKey: 'Settings',
    iconKey: 'Settings',
    to: '/settings/backups',
    match: (p) => p.startsWith('/settings'),
    roles: ['super_admin', 'wh_manager'],
  },
];

/** First path segment groups used for route guards. */
function routeGroup(pathname: string): string {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (p === '/' || p.startsWith('/dashboard')) return 'dashboard';
  if (p.startsWith('/oms')) return 'oms';
  if (p.startsWith('/reports')) return 'reports';
  if (p.startsWith('/orders')) return 'orders';
  if (p.startsWith('/contracts')) return 'contracts';
  if (p.startsWith('/inventory') || p === '/adjustments') return 'inventory';
  if (p === '/internal') return 'internal';
  if (p.startsWith('/tasks')) return 'tasks';
  if (p.startsWith('/cycle-count')) return 'cycle-count';
  if (p.startsWith('/returns')) return 'returns';
  if (p.startsWith('/products')) return 'products';
  if (p.startsWith('/locations')) return 'locations';
  if (p.startsWith('/warehouses')) return 'warehouses';
  if (p.startsWith('/clients')) return 'clients';
  if (p.startsWith('/forms')) return 'forms';
  if (p.startsWith('/billing')) return 'billing';
  if (p.startsWith('/users')) return 'users';
  if (p.startsWith('/audit-logs')) return 'audit-logs';
  if (p.startsWith('/notifications')) return 'notifications';
  if (p.startsWith('/settings')) return 'settings';
  if (p.startsWith('/profile')) return 'profile';
  return 'other';
}

const ROUTE_GROUP_ROLES: Record<string, InternalRole[]> = {
  dashboard: ['super_admin', 'wh_manager', 'finance'],
  oms: ['super_admin', 'wh_manager', 'finance'],
  reports: ['super_admin', 'wh_manager', 'finance'],
  orders: ['super_admin', 'wh_manager', 'finance'],
  contracts: ['super_admin', 'wh_manager', 'wh_operator', 'finance'],
  inventory: ['super_admin', 'wh_manager', 'finance'],
  tasks: ['super_admin', 'wh_manager', 'wh_operator'],
  'cycle-count': ['super_admin', 'wh_manager', 'wh_operator'],
  returns: ['super_admin', 'wh_manager', 'wh_operator'],
  internal: INTERNAL_TRANSFER_ROLES,
  products: ['super_admin', 'wh_manager'],
  locations: ['super_admin', 'wh_manager'],
  warehouses: ['super_admin', 'wh_manager'],
  clients: ['super_admin', 'wh_manager'],
  forms: ['super_admin', 'wh_manager'],
  billing: ['super_admin', 'wh_manager', 'finance'],
  users: ['super_admin', 'wh_manager'],
  'audit-logs': ['super_admin', 'wh_manager', 'finance'],
  notifications: ALL_ROLES,
  settings: ['super_admin', 'wh_manager'],
  profile: ALL_ROLES,
  other: ALL_ROLES,
};

export function normalizeInternalRole(role: string | undefined): InternalRole | null {
  if (!role) return null;
  if (role === 'super_admin' || role === 'wh_manager' || role === 'wh_operator' || role === 'finance') {
    return role;
  }
  return null;
}

export function canAccessInternalTransfer(role: string | undefined): boolean {
  const r = normalizeInternalRole(role);
  if (!r) return false;
  return INTERNAL_TRANSFER_ROLES.includes(r);
}

export function canAccessPath(role: string | undefined, pathnameOrUrl: string): boolean {
  const r = normalizeInternalRole(role);
  if (!r) return false;
  const pathname = pathnameOrUrl.split('?')[0]?.split('#')[0] ?? pathnameOrUrl;
  if (
    pathname === '/orders/directed-outbound' ||
    pathname === '/directed-outbound' ||
    pathname.startsWith('/orders/directed-outbound/')
  ) {
    return false;
  }
  const group = routeGroup(pathname);
  const allowed = ROUTE_GROUP_ROLES[group] ?? ALL_ROLES;
  return allowed.includes(r);
}

export function defaultHomePath(role: string | undefined): string {
  const r = normalizeInternalRole(role);
  if (r === 'wh_operator') return '/tasks';
  if (r === 'finance') return '/dashboard/overview';
  return '/dashboard/overview';
}

export function navItemsForRole(role: string | undefined): NavItemDef[] {
  const r = normalizeInternalRole(role);
  if (!r) return [];
  const showOmsCodReturns = isOmsCodReturnsUiEnabled();
  return NAV_CATALOG.filter((item) => item.roles.includes(r))
    .filter((item) => showOmsCodReturns || !isOmsCodReturnsPath(item.to))
    .map(({ labelKey, iconKey, to, match, group }) => ({
      labelKey,
      iconKey,
      to,
      match,
      group: group ?? null,
    }));
}

export function isOperatorRole(role: string | undefined): boolean {
  return normalizeInternalRole(role) === 'wh_operator';
}

/** Blind count execution APIs require a linked Worker profile (`/auth/me` → workerId). */
export function canExecuteCycleCount(user: { workerId?: string | null } | null | undefined): boolean {
  return !!user?.workerId?.trim();
}

/** Finance / managers may record the final carrier shipping fee after delivery. */
export function canRecordFinalOmsShippingFee(role: string | undefined): boolean {
  const r = normalizeInternalRole(role);
  return r === 'super_admin' || r === 'wh_manager' || r === 'finance';
}
