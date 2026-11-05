import type { ReactElement } from 'react';

import { OmsSheet } from '../components/sheets/OmsSheet';
import { ListPageHeader } from '../design-v2/ListPageHeader';
import { isClientArabic } from '../lib/client-ui-language';

export function SheetsPage(): ReactElement {
  const isArabic = isClientArabic();
  return (
    <div className="space-y-4">
      <ListPageHeader
        icon="fa-table"
        title={isArabic ? 'الشيتات' : 'Sheets'}
        subtitle={isArabic ? 'أضف وعدّل طلباتك في جدول واحد' : 'Add and edit your orders in one table'}
      />
      <OmsSheet isArabic={isArabic} />
    </div>
  );
}
