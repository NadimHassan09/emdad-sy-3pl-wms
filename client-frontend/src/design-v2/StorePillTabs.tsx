import type { ReactElement } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { PillTabs } from './PillTabs';

const TABS = [
  { id: '/ecommerce-orders', label: { en: 'Online orders', ar: 'الطلبات الإلكترونية' }, match: (p: string) => p.startsWith('/ecommerce-orders') && !p.startsWith('/ecommerce-orders/returns') },
  { id: '/my-profits', label: { en: 'Cash on delivery', ar: 'الدفع عند الاستلام' }, match: (p: string) => p.startsWith('/my-profits') || p.startsWith('/cod-reports') },
  { id: '/ecommerce-orders/returns', label: { en: 'Returns', ar: 'المرتجعات' }, match: (p: string) => p.startsWith('/ecommerce-orders/returns') || p.startsWith('/returns') },
];

/** Store-section pill tabs (Online orders / Cash on delivery / Returns). */
export function StorePillTabs({ isArabic }: { isArabic: boolean }): ReactElement {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const activeId = TABS.find((tab) => tab.match(pathname))?.id ?? TABS[0].id;

  return (
    <PillTabs
      activeId={activeId}
      onSelect={(id) => navigate(id)}
      tabs={TABS.map((tab) => ({ id: tab.id, label: isArabic ? tab.label.ar : tab.label.en }))}
    />
  );
}
