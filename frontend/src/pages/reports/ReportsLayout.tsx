import { Outlet } from 'react-router-dom';

import { Alert } from '@ds';

import { AdminListPageShell } from '../../components/AdminListPageShell';
import { ReportsNav } from '../../components/reports/ReportsNav';
import { useDefaultWarehouseId } from '../../hooks/useDefaultWarehouse';

function useIsArabic(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.localStorage.getItem('wms-ui-language') === 'AR' ||
    document.documentElement.dir === 'rtl'
  );
}

function t(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'Reporting Center': 'مركز التقارير',
    'Warehouse not configured': 'المستودع غير مُعد',
  };
  return ar[label] ?? label;
}

export function ReportsLayout() {
  const isArabic = useIsArabic();
  const tr = (label: string) => t(label, isArabic);
  const { warehouseId } = useDefaultWarehouseId();

  return (
    <AdminListPageShell
      icon="fa-chart-line"
      title={tr('Reporting Center')}
      isArabic={isArabic}
      showSectionNav={false}
    >
      {!warehouseId && (
        <Alert
          variant="warning"
          title={tr('Warehouse not configured')}
          description="Set VITE_DEFAULT_WAREHOUSE_ID or ensure an active warehouse exists."
          compact
        />
      )}

      <ReportsNav isArabic={isArabic} />

      <Outlet context={{ isArabic }} />
    </AdminListPageShell>
  );
}
