import type { ReactElement } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { PillTabs } from './PillTabs';

const TABS = [
  { id: '/ecommerce-orders', label: { en: 'Online orders', ar: 'الطلبات الإلكترونية' } },
  { id: '/my-profits', label: { en: 'My profits', ar: 'أرباحي' } },
  { id: '/returns', label: { en: 'Returns', ar: 'المرتجعات' } },
];

/** Store-section pill tabs (Online orders / COD / Returns) — matches the HTML
 * reference's `StorePage` subtab bar while keeping real routes per section. */
export function StorePillTabs({ isArabic }: { isArabic: boolean }): ReactElement {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const activeId = TABS.find((tab) => pathname.startsWith(tab.id))?.id ?? TABS[0].id;

  return (
    <PillTabs
      activeId={activeId}
      onSelect={(id) => navigate(id)}
      tabs={TABS.map((tab) => ({ id: tab.id, label: isArabic ? tab.label.ar : tab.label.en }))}
    />
  );
}
