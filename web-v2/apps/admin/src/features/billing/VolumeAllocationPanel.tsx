import { useUiPreferences } from '@emdad/core'
import type { BillingCapacitySummary, CompanyStorageSummary } from '@/api/billing'
import { formatDecimal } from '@/lib/billing-plan-overview'

type Props = {
  capacity?: BillingCapacitySummary
  storage?: CompanyStorageSummary
  reservedVolume?: string
  loading?: boolean
  title?: string
  description?: string
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-4 py-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

export function VolumeAllocationPanel({
  capacity,
  storage,
  reservedVolume,
  loading,
  title,
  description,
}: Props) {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  const resolvedTitle = title ?? t('Storage utilization', 'استخدام التخزين')
  const resolvedDescription =
    description ??
    t(
      'Used storage is calculated from current inventory quantity × product volume (CBM). Location dimensions are not used for billing.',
      'يُحسب التخزين المستخدم من كمية المخزون الحالية × حجم المنتج (م³). أبعاد المواقع لا تُستخدم للفوترة.',
    )

  if (loading) {
    return <p className="text-sm text-muted-foreground">{t('Loading storage…', 'جاري تحميل التخزين…')}</p>
  }

  const used = storage?.usedStorageCbm ?? capacity?.usedStorageCbm ?? capacity?.allocatedVolumeCbm ?? '0'
  const reserved =
    storage?.reservedStorageCbm ??
    capacity?.reservedStorageCbm ??
    reservedVolume ??
    capacity?.totalWarehouseVolumeCbm ??
    '0'
  const remaining =
    storage?.remainingStorageCbm ?? capacity?.remainingStorageCbm ?? capacity?.remainingAllocatableCbm ?? '0'
  const utilization = storage?.storageUsagePercent ?? capacity?.storageUsagePercent ?? 0

  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <h3 className="text-sm font-semibold">{resolvedTitle}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{resolvedDescription}</p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={t('Reserved storage', 'التخزين المحجوز')}
          value={`${formatDecimal(reserved, 4)} CBM`}
        />
        <Stat label={t('Used storage', 'التخزين المستخدم')} value={`${formatDecimal(used, 4)} CBM`} />
        <Stat
          label={t('Remaining storage', 'التخزين المتبقي')}
          value={`${formatDecimal(remaining, 4)} CBM`}
        />
        <Stat
          label={t('Storage utilization', 'نسبة الاستخدام')}
          value={`${Number(utilization).toFixed(1)}%`}
        />
      </dl>
    </section>
  )
}
