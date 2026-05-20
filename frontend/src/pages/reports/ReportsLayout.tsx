import { Link, Outlet } from 'react-router-dom';

import { Alert, AppPageHeader } from '@ds';

import { PANEL_CARD_CLASS } from '../../components/FilterPanel';
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
    Dashboard: 'لوحة التحكم',
    Reports: 'التقارير',
    'Warehouse not configured': 'المستودع غير مُعد',
    '3PL operational analytics for client-owned inventory, fulfillment, and warehouse performance.':
      'تحليلات تشغيلية لمخزون العملاء والتنفيذ وأداء المستودع.',
  };
  return ar[label] ?? label;
}

export function ReportsLayout() {
  const isArabic = useIsArabic();
  const tr = (label: string) => t(label, isArabic);
  const { warehouseId } = useDefaultWarehouseId();

  return (
    <div className="space-y-6">
      <AppPageHeader
        title={tr('Reporting Center')}
        description={tr(
          '3PL operational analytics for client-owned inventory, fulfillment, and warehouse performance.',
        )}
        meta={
          <nav className="text-sm text-slate-500" aria-label="Breadcrumb">
            <Link to="/dashboard/overview" className="hover:text-emerald-700 hover:underline">
              {tr('Dashboard')}
            </Link>
            <span className="mx-2 text-slate-300">/</span>
            <span className="text-slate-700">{tr('Reports')}</span>
          </nav>
        }
      />

      {!warehouseId && (
        <Alert
          variant="warning"
          title={tr('Warehouse not configured')}
          description="Set VITE_DEFAULT_WAREHOUSE_ID or ensure an active warehouse exists."
          compact
        />
      )}

      <section className={PANEL_CARD_CLASS}>
        <ReportsNav isArabic={isArabic} />
      </section>

      <Outlet context={{ isArabic }} />
    </div>
  );
}
