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

const ORDERS_SECTION: SectionSubNavConfig = {
  ariaLabel: 'Orders navigation',
  ariaLabelAr: 'تنقل الطلبات',
  matchSection: (p) =>
    (p.startsWith('/inbound-orders') ||
      p.startsWith('/outbound-orders') ||
      p.startsWith('/ecommerce-orders') ||
      p.startsWith('/cod-reports') ||
      p.startsWith('/returns')) &&
    !isOrdersDetailPath(p),
  items: [
    {
      labelKey: 'Inbound orders',
      labelAr: 'طلبات الوارد',
      to: '/inbound-orders',
      match: (p) => p.startsWith('/inbound-orders'),
    },
    {
      labelKey: 'My orders',
      labelAr: 'طلباتي',
      to: '/outbound-orders',
      match: (p) => p.startsWith('/outbound-orders'),
    },
    {
      labelKey: 'E-commerce orders',
      labelAr: 'طلبات التجارة الإلكترونية',
      to: '/ecommerce-orders',
      match: (p) => p.startsWith('/ecommerce-orders'),
    },
    {
      labelKey: 'COD reports',
      labelAr: 'تقارير COD',
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

const SECTIONS: SectionSubNavConfig[] = [ORDERS_SECTION];

export function resolveSectionSubNav(pathname: string): SectionSubNavConfig | null {
  return SECTIONS.find((c) => c.matchSection(pathname)) ?? null;
}
