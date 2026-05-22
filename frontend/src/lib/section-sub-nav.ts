/**
 * Section sub-navigation — tabs for route groups with multiple sibling list routes.
 */

export type SectionSubNavItemConfig = {
  labelKey: string;
  to: string;
  match: (pathname: string, search: string) => boolean;
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
    matchSection: (p) => p.startsWith('/tasks') || p === '/internal',
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
];

export function resolveSectionSubNav(pathname: string): SectionSubNavConfig | null {
  return SECTION_SUB_NAV_CONFIGS.find((c) => c.matchSection(pathname)) ?? null;
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
    'Users navigation': 'تنقل المستخدمين',
    'Warehouse users': 'مستخدمو المستودع',
    'Client users': 'مستخدمو العملاء',
  };
  return ar[label] ?? label;
}
