/**
 * Section sub-navigation — tabs for route groups with multiple sibling list routes.
 */

import {
  canAccessInternalTransfer,
  canAccessPath,
  canExecuteCycleCount,
  normalizeInternalRole,
  type InternalRole,
} from './rbac';

export type SectionSubNavItemConfig = {
  labelKey: string;
  to: string;
  match: (pathname: string, search: string) => boolean;
  /** When set, only these internal roles see the tab (still checked against route guards). */
  roles?: InternalRole[];
};

function taskTypeFromSearch(search: string): string | null {
  return new URLSearchParams(search).get('taskType');
}

function tasksListTaskTypeMatch(pathname: string, search: string, taskType: string): boolean {
  return pathname === '/tasks' && taskTypeFromSearch(search) === taskType;
}

/** Inbound/outbound order detail — sub-nav tabs are list-only. */
function isOrdersDetailPath(pathname: string): boolean {
  return /^\/orders\/(inbound|outbound)\/[^/]+$/.test(pathname);
}

export type SectionSubNavConfig = {
  ariaLabelKey: string;
  matchSection: (pathname: string) => boolean;
  items: SectionSubNavItemConfig[];
};

export const SECTION_SUB_NAV_CONFIGS: SectionSubNavConfig[] = [
  {
    ariaLabelKey: 'Inventory navigation',
    matchSection: (p) => p.startsWith('/inventory'),
    items: [
      {
        labelKey: 'Stock',
        to: '/inventory/stock',
        match: (p) => p === '/inventory/stock' || p.startsWith('/inventory/product/'),
      },
      {
        labelKey: 'Ledger',
        to: '/inventory/ledger',
        match: (p) => p.startsWith('/inventory/ledger'),
      },
      {
        labelKey: 'Adjustments',
        to: '/inventory/adjustments',
        match: (p) => p === '/inventory/adjustments' || p.startsWith('/inventory/adjustments/'),
      },
    ],
  },
  {
    ariaLabelKey: 'Orders navigation',
    matchSection: (p) => p.startsWith('/orders') && !isOrdersDetailPath(p),
    items: [
      {
        labelKey: 'Inbound orders',
        to: '/orders/inbound',
        match: (p) => p.startsWith('/orders/inbound'),
      },
      {
        labelKey: 'Outbound orders',
        to: '/orders/outbound',
        match: (p) => p.startsWith('/orders/outbound'),
      },
    ],
  },
  {
    ariaLabelKey: 'Tasks navigation',
    matchSection: (p) => {
      if (p === '/internal') return true;
      if (!p.startsWith('/tasks')) return false;
      // Hide sub-nav on task detail / execute pages
      return !/^\/tasks\/[^/]+(\/execute)?$/.test(p);
    },
    items: [
      {
        labelKey: 'Tasks',
        to: '/tasks',
        match: (p, s) => p.startsWith('/tasks') && !taskTypeFromSearch(s),
      },
      {
        labelKey: 'Receive',
        to: '/tasks?taskType=receiving',
        match: (p, s) => tasksListTaskTypeMatch(p, s, 'receiving'),
      },
      {
        labelKey: 'Putaway',
        to: '/tasks?taskType=putaway',
        match: (p, s) => tasksListTaskTypeMatch(p, s, 'putaway'),
      },
      {
        labelKey: 'Pick',
        to: '/tasks?taskType=pick',
        match: (p, s) => tasksListTaskTypeMatch(p, s, 'pick'),
      },
      {
        labelKey: 'Pack',
        to: '/tasks?taskType=pack',
        match: (p, s) => tasksListTaskTypeMatch(p, s, 'pack'),
      },
      {
        labelKey: 'Delivery',
        to: '/tasks?taskType=dispatch',
        match: (p, s) => tasksListTaskTypeMatch(p, s, 'dispatch'),
      },
      {
        labelKey: 'Internal transfer',
        to: '/internal',
        match: (p) => p === '/internal',
        roles: ['super_admin', 'wh_manager'],
      },
    ],
  },
  {
    ariaLabelKey: 'Returns navigation',
    matchSection: (p) => p.startsWith('/returns') && !/^\/returns\/[^/]+(\/process)?$/.test(p),
    items: [
      {
        labelKey: 'Dashboard',
        to: '/returns',
        match: (p) => p === '/returns',
      },
    ],
  },
  {
    ariaLabelKey: 'Cycle count navigation',
    matchSection: (p) => {
      if (!p.startsWith('/cycle-count')) return false;
      return !/^\/cycle-count\/[^/]+(\/execute)?$/.test(p);
    },
    items: [
      {
        labelKey: 'Dashboard',
        to: '/cycle-count',
        match: (p) => p === '/cycle-count',
      },
      {
        labelKey: 'My tasks',
        to: '/cycle-count/my-tasks',
        match: (p) => p === '/cycle-count/my-tasks',
      },
    ],
  },
  {
    ariaLabelKey: 'Users navigation',
    matchSection: (p) => p.startsWith('/users'),
    items: [
      {
        labelKey: 'Warehouse users',
        to: '/users/warehouse_users',
        match: (p) => p.startsWith('/users/warehouse_users'),
      },
      {
        labelKey: 'Client users',
        to: '/users/client_users',
        match: (p) => p.startsWith('/users/client_users'),
      },
    ],
  },
  {
    ariaLabelKey: 'Billing navigation',
    matchSection: (p) => p.startsWith('/billing'),
    items: [
      {
        labelKey: 'Dashboard',
        to: '/billing/dashboard',
        match: (p) => p === '/billing/dashboard' || p === '/billing',
      },
      {
        labelKey: 'Plans',
        to: '/billing/plans',
        match: (p) => p.startsWith('/billing/plans'),
      },
      {
        labelKey: 'Invoices',
        to: '/billing/invoices',
        match: (p) => p.startsWith('/billing/invoices'),
      },
    ],
  },
];

export function resolveSectionSubNav(pathname: string): SectionSubNavConfig | null {
  return SECTION_SUB_NAV_CONFIGS.find((c) => c.matchSection(pathname)) ?? null;
}

type SectionSubNavUser = { role?: string; workerId?: string | null } | null | undefined;

/** Role-aware sub-nav items — aligned with `ROUTE_GROUP_ROLES` and backend `InternalAdminGuard`. */
export function filterSectionSubNavItems(
  items: SectionSubNavItemConfig[],
  user: SectionSubNavUser,
): SectionSubNavItemConfig[] {
  const role = user?.role;
  return items.filter((item) => {
    if (item.roles) {
      const normalized = normalizeInternalRole(role);
      if (!normalized || !item.roles.includes(normalized)) return false;
    }
    if (item.to === '/internal' && !canAccessInternalTransfer(role)) return false;
    if (!canAccessPath(role, item.to)) return false;
    if (item.to === '/cycle-count/my-tasks' && !canExecuteCycleCount(user)) return false;
    return true;
  });
}

export function sectionSubNavLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'Inventory navigation': 'تنقل المخزون',
    Stock: 'المخزون',
    Ledger: 'السجل',
    Adjustments: 'التعديلات',
    'Orders navigation': 'تنقل الطلبات',
    'Inbound orders': 'طلبات الوارد',
    'Outbound orders': 'طلبات الصادر',
    'Tasks navigation': 'تنقل المهام',
    Tasks: 'المهام',
    Receive: 'استلام',
    Putaway: 'تخزين',
    Pick: 'التقاط',
    Pack: 'تغليف',
    Delivery: 'تسليم',
    'Internal transfer': 'نقل داخلي',
    'Returns navigation': 'تنقل الإرجاعات',
    'Cycle count navigation': 'تنقل الجرد',
    Dashboard: 'لوحة الجرد',
    'My tasks': 'مهامي',
    'Users navigation': 'تنقل المستخدمين',
    'Warehouse users': 'مستخدمو المستودع',
    'Client users': 'مستخدمو العملاء',
    'Billing navigation': 'تنقل الفوترة',
    Plans: 'الخطط',
    Invoices: 'الفواتير',
  };
  return ar[label] ?? label;
}
