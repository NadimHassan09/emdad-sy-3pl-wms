import { useState, type ReactElement } from 'react';

import { OmsSheet } from '../components/sheets/OmsSheet';
import { WmsOrdersSheet } from '../components/sheets/WmsOrdersSheet';
import { ListPageHeader } from '../design-v2/ListPageHeader';
import { isClientArabic } from '../lib/client-ui-language';

type Tab = 'oms' | 'inbound' | 'outbound';

export function SheetsPage(): ReactElement {
  const isArabic = isClientArabic();
  const [tab, setTab] = useState<Tab>('oms');
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'oms', label: isArabic ? 'طلبات التوصيل (OMS)' : 'Delivery orders (OMS)' },
    { id: 'inbound', label: isArabic ? 'الاستلام' : 'Inbound' },
    { id: 'outbound', label: isArabic ? 'الصرف' : 'Outbound' },
  ];
  return (
    <div className="space-y-4">
      <ListPageHeader
        icon="fa-table"
        title={isArabic ? 'الشيتات' : 'Sheets'}
        subtitle={isArabic ? 'أضف وعدّل طلباتك في جدول واحد' : 'Add and edit your orders in one table'}
      />
      <div className="flex gap-1 border-b border-neutral-200 dark:border-neutral-700" role="tablist">
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={tab === x.id}
            onClick={() => setTab(x.id)}
            className={`px-4 py-2 text-sm ${tab === x.id ? 'border-b-2 border-emerald-600 font-medium' : 'text-neutral-500'}`}
          >
            {x.label}
          </button>
        ))}
      </div>
      {tab === 'oms' ? <OmsSheet isArabic={isArabic} /> : <WmsOrdersSheet key={tab} kind={tab} isArabic={isArabic} />}
    </div>
  );
}
