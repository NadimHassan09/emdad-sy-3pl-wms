import { useQuery } from '@tanstack/react-query';

import { CompaniesApi } from '../../api/companies';
import { WorkersApi } from '../../api/workers';
import { QK } from '../../constants/query-keys';
import { companyFilterComboboxOptions } from '../../lib/company-filter-options';
import type { ReportDefinition, ReportFilterValues } from '../../lib/reports/types';
import { Combobox } from '../Combobox';
import { FilterPanel } from '../FilterPanel';
import { SelectField } from '../SelectField';
import { TextField } from '../TextField';

const TASK_TYPE_OPTIONS = [
  { value: '', label: 'All task types', labelAr: 'كل أنواع المهام' },
  { value: 'receiving', label: 'Receiving', labelAr: 'استلام' },
  { value: 'putaway', label: 'Putaway', labelAr: 'تخزين' },
  { value: 'pick', label: 'Pick', labelAr: 'التقاط' },
  { value: 'pack', label: 'Pack', labelAr: 'تغليف' },
  { value: 'dispatch', label: 'Delivery', labelAr: 'تسليم' },
  { value: 'routing', label: 'Routing', labelAr: 'توجيه' },
];

type ReportFiltersPanelProps = {
  report: ReportDefinition;
  draft: ReportFilterValues;
  onChange: (patch: Partial<ReportFilterValues>) => void;
  onApply: () => void;
  onReset: () => void;
  loading?: boolean;
  isArabic: boolean;
  warehouses: Array<{ id: string; name: string; code: string }>;
};

export function ReportFiltersPanel({
  report,
  draft,
  onChange,
  onApply,
  onReset,
  loading,
  isArabic,
  warehouses,
}: ReportFiltersPanelProps) {
  const t = (en: string, ar: string) => (isArabic ? ar : en);

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list({ includeAll: true }),
    staleTime: 10 * 60_000,
  });

  const workers = useQuery({
    queryKey: [...QK.workers.all, draft.warehouseId],
    queryFn: () => WorkersApi.list(draft.warehouseId || undefined),
    enabled: report.filterKeys.includes('employee'),
    staleTime: 5 * 60_000,
  });

  const clientOptions = companyFilterComboboxOptions(
    companies.data,
    t('All clients', 'كل العملاء'),
  );

  const warehouseOptions = [
    { value: '', label: t('Default warehouse', 'المستودع الافتراضي') },
    ...warehouses.map((w) => ({ value: w.id, label: `${w.name} (${w.code})` })),
  ];

  const statusLabel =
    report.id === 'product-moves'
      ? t('Movement type', 'نوع الحركة')
      : report.id === 'inventory'
        ? t('Stock status', 'حالة المخزون')
        : t('Status', 'الحالة');

  const statusOptions =
    report.statusOptions?.map((o) => ({
      value: o.value,
      label: isArabic ? o.labelAr : o.label,
    })) ?? [{ value: '', label: t('All', 'الكل') }];

  return (
    <FilterPanel
      title={t('Report filters', 'فلاتر التقرير')}
      onApply={onApply}
      onReset={onReset}
      loading={loading}
      applyLabel={t('Apply filters', 'تطبيق الفلاتر')}
      resetLabel={t('Reset filters', 'إعادة تعيين')}
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {report.filterKeys.includes('warehouse') && (
          <SelectField
            label={t('Warehouse', 'المستودع')}
            value={draft.warehouseId}
            onChange={(e) => onChange({ warehouseId: e.target.value })}
            options={warehouseOptions}
          />
        )}
        {report.filterKeys.includes('client') && (
          <Combobox
            label={t('Client', 'العميل')}
            value={draft.companyId}
            onChange={(v) => onChange({ companyId: v })}
            options={clientOptions}
            placeholder={t('All clients', 'كل العملاء')}
          />
        )}
        {report.filterKeys.includes('status') && (
          <SelectField
            label={statusLabel}
            value={draft.status}
            onChange={(e) => onChange({ status: e.target.value })}
            options={statusOptions}
          />
        )}
        {report.filterKeys.includes('sku') && (
          <TextField
            label={t('SKU search', 'بحث برمز الصنف')}
            value={draft.sku}
            onChange={(e) => onChange({ sku: e.target.value })}
            placeholder={t('Filter by SKU…', 'تصفية برمز الصنف…')}
            className="font-mono text-xs"
          />
        )}
        {report.filterKeys.includes('taskType') && (
          <SelectField
            label={t('Task type', 'نوع المهمة')}
            value={draft.taskType}
            onChange={(e) => onChange({ taskType: e.target.value })}
            options={TASK_TYPE_OPTIONS.map((o) => ({
              value: o.value,
              label: isArabic ? o.labelAr : o.label,
            }))}
          />
        )}
        {report.filterKeys.includes('groupBy') && report.groupByOptions && (
          <SelectField
            label={t('Group by', 'تجميع حسب')}
            value={draft.groupBy}
            onChange={(e) => onChange({ groupBy: e.target.value })}
            options={[
              { value: '', label: t('None', 'بدون') },
              ...report.groupByOptions.map((o) => ({
                value: o.value,
                label: isArabic ? o.labelAr : o.label,
              })),
            ]}
          />
        )}
        {report.filterKeys.includes('employee') && (
          <Combobox
            label={t('Employee', 'الموظف')}
            value={draft.employeeId}
            onChange={(v) => onChange({ employeeId: v })}
            options={[
              { value: '', label: t('All workers', 'كل العمال') },
              ...(workers.data ?? []).map((w) => ({
                value: w.id,
                label: w.displayName,
              })),
            ]}
            placeholder={t('All workers', 'كل العمال')}
          />
        )}
      </div>
    </FilterPanel>
  );
}
