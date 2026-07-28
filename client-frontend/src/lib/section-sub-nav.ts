export type SectionSubNavItemConfig = {
  labelKey: string;
  labelAr: string;
  to: string;
  match: (pathname: string) => boolean;
};

export type SectionSubNavConfig = {
  ariaLabel: string;
  ariaLabelAr: string;
  matchSection: (pathname: string) => boolean;
  items: SectionSubNavItemConfig[];
};

function isOrdersDetailPath(pathname: string): boolean {
  return (
    /^\/(inbound|outbound|ecommerce)-orders\/[^/]+$/.test(pathname) ||
    /^\/returns\/[^/]+$/.test(pathname)
  );
}

const WMS_ORDERS_SECTION: SectionSubNavConfig = {
  ariaLabel: 'Warehouse orders navigation',
  ariaLabelAr: 'تنقل طلبات المستودع',
  matchSection: (p) =>
    (p.startsWith('/inbound-orders') || p.startsWith('/outbound-orders')) && !isOrdersDetailPath(p),
  items: [
    {
      labelKey: 'Inbound',
      labelAr: 'الوارد',
      to: '/inbound-orders',
      match: (p) => p.startsWith('/inbound-orders'),
    },
    {
      labelKey: 'Outbound',
      labelAr: 'الصادر',
      to: '/outbound-orders',
      match: (p) => p.startsWith('/outbound-orders'),
    },
  ],
};

const OMS_SECTION: SectionSubNavConfig = {
  ariaLabel: 'Store orders navigation',
  ariaLabelAr: 'تنقل طلبات المتجر',
  matchSection: (p) =>
    (p.startsWith('/ecommerce-orders') ||
      p.startsWith('/cod-reports') ||
      p.startsWith('/returns')) &&
    !isOrdersDetailPath(p),
  items: [
    {
      labelKey: 'Online orders',
      labelAr: 'الطلبات الإلكترونية',
      to: '/ecommerce-orders',
      match: (p) => p.startsWith('/ecommerce-orders'),
    },
    {
      labelKey: 'Cash on delivery',
      labelAr: 'الدفع عند الاستلام',
      to: '/cod-reports',
      match: (p) => p.startsWith('/cod-reports'),
    },
    {
      labelKey: 'Returns',
      labelAr: 'المرتجعات',
      to: '/returns',
      match: (p) => p.startsWith('/returns'),
    },
  ],
};

const SECTIONS: SectionSubNavConfig[] = [WMS_ORDERS_SECTION, OMS_SECTION];

export function resolveSectionSubNav(pathname: string): SectionSubNavConfig | null {
  return SECTIONS.find((c) => c.matchSection(pathname)) ?? null;
}
