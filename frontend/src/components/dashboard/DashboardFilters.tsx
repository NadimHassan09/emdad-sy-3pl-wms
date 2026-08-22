import type { CompanyListRow } from '../../api/companies';
import type { Warehouse } from '../../api/warehouses';

import { dashboardLabel } from './dashboard-i18n';
import type { PeriodKey } from './dashboard-utils';

const SELECT_CLASS =
  'h-9 min-w-[10rem] max-w-full rounded-[10px] border border-border bg-surface-panel px-3 text-xs font-medium text-text-body ' +
  'transition-colors hover:border-brand-200 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:hover:border-brand-800';

export type DashboardFilterState = {
  warehouseId: string;
  companyId: string;
  period: PeriodKey;
};

export function DashboardFilters({
  warehouses,
  companies,
  value,
  onChange,
  isArabic,
}: {
  warehouses: Warehouse[];
  companies: CompanyListRow[];
  value: DashboardFilterState;
  onChange: (next: DashboardFilterState) => void;
  isArabic: boolean;
}) {
  const t = (s: string) => dashboardLabel(s, isArabic);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2">
        <span className="sr-only">{t('Warehouse')}</span>
        <select
          className={SELECT_CLASS}
          value={value.warehouseId}
          onChange={(e) => onChange({ ...value, warehouseId: e.target.value })}
          aria-label={t('Warehouse')}
        >
          <option value="">{t('Warehouse')}: {t('All Warehouses')}</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2">
        <span className="sr-only">{t('Client')}</span>
        <select
          className={SELECT_CLASS}
          value={value.companyId}
          onChange={(e) => onChange({ ...value, companyId: e.target.value })}
          aria-label={t('Client')}
        >
          <option value="">{t('Client')}: {t('All Clients')}</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.tradeName?.trim() || c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2">
        <span className="sr-only">{t('Period')}</span>
        <select
          className={SELECT_CLASS}
          value={value.period}
          onChange={(e) => onChange({ ...value, period: e.target.value as PeriodKey })}
          aria-label={t('Period')}
        >
          <option value="7">{t('Period')}: {t('Last 7 days')}</option>
          <option value="30">{t('Period')}: {t('Last 30 days')}</option>
          <option value="90">{t('Period')}: {t('Last 90 days')}</option>
        </select>
      </label>
    </div>
  );
}
