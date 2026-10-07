import { useQuery } from '@tanstack/react-query'
import { FilterBar } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { Combobox } from '@emdad/ui/ui/combobox'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { CompaniesApi } from '@/api/companies'
import { WorkersApi } from '@/api/workers'
import { QK } from '@/constants/query-keys'
import { companyFilterComboboxOptions } from '@/lib/company-filter-options'
import type { ReportDefinition, ReportFilterValues } from '@/lib/reports/types'

const TASK_TYPE_OPTIONS = [
  { value: '', label: 'All task types', labelAr: 'كل أنواع المهام' },
  { value: 'receiving', label: 'Receiving', labelAr: 'استلام' },
  { value: 'putaway', label: 'Putaway', labelAr: 'تخزين' },
  { value: 'pick', label: 'Pick', labelAr: 'التقاط' },
  { value: 'pack', label: 'Pack', labelAr: 'تغليف' },
  { value: 'dispatch', label: 'Dispatch', labelAr: 'إرسال' },
  { value: 'routing', label: 'Routing', labelAr: 'توجيه' },
]

type Props = {
  report: ReportDefinition
  draft: ReportFilterValues
  onChange: (patch: Partial<ReportFilterValues>) => void
  onApply: () => void
  onReset: () => void
  loading?: boolean
  isArabic: boolean
  warehouses: Array<{ id: string; name: string; code: string }>
}

export function ReportFiltersPanel({
  report,
  draft,
  onChange,
  onApply,
  onReset,
  loading,
  isArabic,
  warehouses,
}: Props) {
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list({ includeAll: true }),
    staleTime: 10 * 60_000,
  })

  const workers = useQuery({
    queryKey: [...QK.workers.all, draft.warehouseId, draft.companyId],
    queryFn: () =>
      WorkersApi.list({
        warehouseId: draft.warehouseId || undefined,
        companyId: draft.companyId || undefined,
      }),
    enabled: report.filterKeys.includes('employee'),
    staleTime: 5 * 60_000,
  })

  const clientOptions = companyFilterComboboxOptions(companies.data, t('All clients', 'كل العملاء'))

  const warehouseOptions = [
    { value: '', label: t('Default warehouse', 'المستودع الافتراضي') },
    ...warehouses.map((w) => ({ value: w.id, label: `${w.name} (${w.code})` })),
  ]

  const statusLabel =
    report.id === 'product-moves'
      ? t('Movement type', 'نوع الحركة')
      : report.id === 'inventory'
        ? t('Stock status', 'حالة المخزون')
        : report.id === 'worker-productivity' || report.id === 'sla-compliance'
          ? t('Task type', 'نوع المهمة')
          : t('Status', 'الحالة')

  const statusOptions =
    report.statusOptions?.map((o) => ({
      value: o.value,
      label: isArabic ? o.labelAr : o.label,
    })) ?? [{ value: '', label: t('All', 'الكل') }]

  return (
    <FilterBar className="mt-4">
      <p className="mb-2 text-sm font-medium">{t('Report filters', 'فلاتر التقرير')}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {report.filterKeys.includes('warehouse') && (
          <div className="space-y-2">
            <Label>{t('Warehouse', 'المستودع')}</Label>
            <Select value={draft.warehouseId || '__default'} onValueChange={(v) => onChange({ warehouseId: v === '__default' ? '' : v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {warehouseOptions.map((o) => (
                  <SelectItem key={o.value || '__default'} value={o.value || '__default'}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {report.filterKeys.includes('client') && (
          <div className="space-y-2">
            <Label>{t('Client', 'العميل')}</Label>
            <Combobox
              value={draft.companyId}
              onChange={(v) => onChange({ companyId: v })}
              options={clientOptions}
              placeholder={t('All clients', 'كل العملاء')}
            />
          </div>
        )}
        {report.filterKeys.includes('status') && (
          <div className="space-y-2">
            <Label>{statusLabel}</Label>
            <Select value={draft.status || '__all'} onValueChange={(v) => onChange({ status: v === '__all' ? '' : v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">{t('All', 'الكل')}</SelectItem>
                {statusOptions
                  .filter((o) => o.value)
                  .map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {report.filterKeys.includes('dateRange') && (
          <>
            <div className="space-y-2">
              <Label>{t('From date', 'من تاريخ')}</Label>
              <Input type="date" value={draft.dateFrom} onChange={(e) => onChange({ dateFrom: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('To date', 'إلى تاريخ')}</Label>
              <Input type="date" value={draft.dateTo} onChange={(e) => onChange({ dateTo: e.target.value })} />
            </div>
          </>
        )}
        {report.filterKeys.includes('sku') && (
          <div className="space-y-2">
            <Label>{t('SKU search', 'بحث برمز الصنف')}</Label>
            <Input
              value={draft.sku}
              onChange={(e) => onChange({ sku: e.target.value })}
              placeholder={t('Filter by SKU…', 'تصفية برمز الصنف…')}
              className="font-mono"
            />
          </div>
        )}
        {report.filterKeys.includes('taskType') && (
          <div className="space-y-2">
            <Label>{t('Task type', 'نوع المهمة')}</Label>
            <Select value={draft.taskType || '__all'} onValueChange={(v) => onChange({ taskType: v === '__all' ? '' : v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value || '__all'} value={o.value || '__all'}>
                    {isArabic ? o.labelAr : o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {report.filterKeys.includes('groupBy') && report.groupByOptions && (
          <div className="space-y-2">
            <Label>{t('Group by', 'تجميع حسب')}</Label>
            <Select value={draft.groupBy || '__none'} onValueChange={(v) => onChange({ groupBy: v === '__none' ? '' : v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">{t('None', 'بدون')}</SelectItem>
                {report.groupByOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {isArabic ? o.labelAr : o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {report.filterKeys.includes('employee') && (
          <div className="space-y-2">
            <Label>{t('Employee', 'الموظف')}</Label>
            <Combobox
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
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onApply} disabled={loading}>
          {t('Apply filters', 'تطبيق الفلاتر')}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onReset} disabled={loading}>
          {t('Reset filters', 'إعادة تعيين')}
        </Button>
      </div>
    </FilterBar>
  )
}
