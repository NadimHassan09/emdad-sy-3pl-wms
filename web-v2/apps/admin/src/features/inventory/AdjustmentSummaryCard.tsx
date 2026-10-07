import type { ReactNode } from 'react'
import { formatDateTime } from '@emdad/core'
import { ADJUSTMENT_REASON_PENDING, type StockAdjustment } from '@/api/adjustments'
import { Card, CardContent, CardHeader, CardTitle } from '@emdad/ui/ui/card'
import { AdjustmentStatusBadge } from './inventory-shared'

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  )
}

export function AdjustmentSummaryCard({
  adjustment,
  t,
  locale,
  isArabic,
}: {
  adjustment: StockAdjustment
  t: (en: string, ar: string) => string
  locale: string
  isArabic: boolean
}) {
  const lines = adjustment.lines ?? []
  const skuSummary =
    lines.length === 0 ? '—' : lines.length === 1 ? lines[0]!.product.sku : `${lines[0]!.product.sku} +${lines.length - 1}`

  const reason =
    adjustment.reason?.trim() && adjustment.reason.trim() !== ADJUSTMENT_REASON_PENDING
      ? adjustment.reason
      : t('(pending)', '(معلق)')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Adjustment information', 'معلومات التعديل')}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <DetailField label={t('Movement type', 'نوع الحركة')} value={t('Adjustments', 'تعديلات')} />
        <DetailField label={t('Product SKU', 'رمز الصنف')} value={<span className="font-mono">{skuSummary}</span>} />
        <DetailField
          label={t('Adjustment ID', 'معرف التعديل')}
          value={<span className="font-mono text-xs">{adjustment.id}</span>}
        />
        <DetailField label={t('Client', 'العميل')} value={adjustment.company?.name ?? '—'} />
        <DetailField
          label={t('Status', 'الحالة')}
          value={<AdjustmentStatusBadge status={adjustment.status} isArabic={isArabic} />}
        />
        <DetailField label={t('Reason', 'السبب')} value={reason} />
        <DetailField label={t('Warehouse', 'المستودع')} value={adjustment.warehouse?.name ?? '—'} />
        <DetailField label={t('Created by', 'أنشأه')} value={adjustment.creator?.fullName ?? '—'} />
        <DetailField
          label={t('Created at', 'تاريخ الإنشاء')}
          value={formatDateTime(adjustment.createdAt, locale)}
        />
        {adjustment.approver ? (
          <DetailField label={t('Approved by', 'اعتمدته')} value={adjustment.approver.fullName} />
        ) : null}
      </CardContent>
    </Card>
  )
}
