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
  return /^\/(inbound|outbound)-orders\/[^/]+$/.test(pathname);
}

const ORDERS_SECTION: SectionSubNavConfig = {
  ariaLabel: 'Orders navigation',
  ariaLabelAr: 'تنقل الطلبات',
  matchSection: (p) =>
    (p.startsWith('/inbound-orders') || p.startsWith('/outbound-orders')) && !isOrdersDetailPath(p),
  items: [
    {
      labelKey: 'Inbound orders',
      labelAr: 'طلبات الوارد',
      to: '/inbound-orders',
      match: (p) => p.startsWith('/inbound-orders'),
    },
    {
      labelKey: 'Outbound orders',
      labelAr: 'طلبات الصادر',
      to: '/outbound-orders',
      match: (p) => p.startsWith('/outbound-orders'),
    },
  ],
};

const SECTIONS: SectionSubNavConfig[] = [ORDERS_SECTION];

export function resolveSectionSubNav(pathname: string): SectionSubNavConfig | null {
  return SECTIONS.find((c) => c.matchSection(pathname)) ?? null;
}
