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
    /^\/(inbound|outbound|ecommerce)-orders\/(?!returns(?:\/|$))[^/]+$/.test(pathname) ||
    /^\/(outbound|ecommerce)-orders\/returns\/[^/]+$/.test(pathname) ||
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
      match: (p) => p.startsWith('/outbound-orders') && !p.startsWith('/outbound-orders/returns'),
    },
    {
      labelKey: 'Returns',
      labelAr: 'المرتجعات',
      to: '/outbound-orders/returns',
      match: (p) => p.startsWith('/outbound-orders/returns'),
    },
  ],
};

const OMS_SECTION: SectionSubNavConfig = {
  ariaLabel: 'Store orders navigation',
  ariaLabelAr: 'تنقل طلبات المتجر',
  matchSection: (p) =>
    (p.startsWith('/ecommerce-orders') ||
      p.startsWith('/my-profits') ||
      p.startsWith('/cod-reports') ||
      p.startsWith('/returns')) &&
    !isOrdersDetailPath(p),
  items: [
    {
      labelKey: 'Online orders',
      labelAr: 'الطلبات الإلكترونية',
      to: '/ecommerce-orders',
      match: (p) => p.startsWith('/ecommerce-orders') && !p.startsWith('/ecommerce-orders/returns'),
    },
    {
      labelKey: 'Cash on delivery',
      labelAr: 'الدفع عند الاستلام',
      to: '/my-profits',
      match: (p) => p.startsWith('/my-profits') || p.startsWith('/cod-reports'),
    },
    {
      labelKey: 'Returns',
      labelAr: 'المرتجعات',
      to: '/ecommerce-orders/returns',
      match: (p) => p.startsWith('/ecommerce-orders/returns') || p.startsWith('/returns'),
    },
  ],
};

const SECTIONS: SectionSubNavConfig[] = [WMS_ORDERS_SECTION, OMS_SECTION];

export function resolveSectionSubNav(pathname: string): SectionSubNavConfig | null {
  return SECTIONS.find((c) => c.matchSection(pathname)) ?? null;
}
