import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { useMemo, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { ArrowLeft, Banknote } from 'lucide-react'
import { formatDateTime, useUiPreferences } from '@emdad/core'
import { DataTable, ErrorState, PageHeader, StatusBadge, type Tone } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@emdad/ui/ui/card'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { Skeleton } from '@emdad/ui/ui/skeleton'
import { CodApi, type CodRecordAdjustment, type CodRecordStatus } from '@/api/oms'
import { QK } from '@/constants/query-keys'

const COD_STATUS_OPTIONS: CodRecordStatus[] = ['pending', 'available', 'paid_out', 'returned']

const COD_STATUS_TONE: Record<CodRecordStatus, Tone> = {
  pending: 'pending',
  available: 'ready',
  paid_out: 'success',
  returned: 'returned',
}

function codStatusLabel(status: CodRecordStatus, isArabic: boolean): string {
  const en: Record<CodRecordStatus, string> = {
    pending: 'Pending',
    available: 'Available',
    paid_out: 'Paid out',
    returned: 'Returned',
  }
  const ar: Record<CodRecordStatus, string> = {
    pending: 'معلق',
    available: 'متاح',
    paid_out: 'تم الصرف',
    returned: 'مرتجع',
  }
  return isArabic ? ar[status] : en[status]
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm">{value}</div>
    </div>
  )
}

function fmtMoney(value: string | null | undefined, currency?: string | null): string {
  if (!value) return '—'
  return `${value}${currency ? ` ${currency}` : ''}`
}

export function OmsCodDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const qc = useQueryClient()

  const detail = useQuery({
    queryKey: QK.omsCodDetail(id),
    queryFn: () => CodApi.getRecord(id),
    enabled: !!id,
  })

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: QK.omsCodDetail(id) })
    void qc.invalidateQueries({ queryKey: QK.omsCod })
  }

  const statusMut = useMutation({
    mutationFn: (status: CodRecordStatus) => CodApi.setStatus(id, status),
    onSuccess: () => {
      toast.success(t('COD status updated.', 'تم تحديث حالة COD.'))
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const adjustmentCols = useMemo<ColumnDef<CodRecordAdjustment>[]>(
    () => [
      {
        id: 'amount',
        header: t('Amount', 'المبلغ'),
        cell: ({ row }) => fmtMoney(row.original.amount, detail.data?.currency),
        meta: { priority: 1, align: 'end', className: 'min-w-24 tabular' },
      },
      {
        id: 'reason',
        header: t('Reason', 'السبب'),
        cell: ({ row }) => row.original.reason?.trim() || '—',
        meta: { priority: 1, className: 'min-w-32' },
      },
      {
        id: 'return',
        header: t('Return', 'مرتجع'),
        cell: ({ row }) =>
          row.original.omsReturnId ? (
            <span className="font-mono text-xs">{row.original.omsReturnId.slice(0, 8)}…</span>
          ) : (
            '—'
          ),
        meta: { priority: 2, className: 'min-w-24' },
      },
      {
        id: 'created',
        header: t('Created', 'تاريخ الإنشاء'),
        cell: ({ row }) => formatDateTime(row.original.createdAt, locale),
        meta: { priority: 2, className: 'min-w-36' },
      },
    ],
    [isArabic, locale, detail.data?.currency], // eslint-disable-line react-hooks/exhaustive-deps
  )


  if (!id) return null

  if (detail.isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-6 w-40" />
        <Card>
          <CardHeader>
            <Skeleton className="h-7 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-36 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (detail.isError || !detail.data) {
    return (
      <div className="space-y-5">
        <Button variant="ghost" size="sm" className="-ms-2 w-fit" asChild>
          <Link to="/oms/cod">
            <ArrowLeft className="rtl:rotate-180" aria-hidden />
            {t('Back to COD', 'العودة إلى COD')}
          </Link>
        </Button>
        <ErrorState title={t('Could not load COD record.', 'تعذر تحميل سجل COD.')} />
      </div>
    )
  }

  const record = detail.data
  const orderLabel = record.omsOrder?.orderNumber ?? record.omsOrderId.slice(0, 8)

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" className="-ms-2 w-fit" asChild>
        <Link to="/oms/cod">
          <ArrowLeft className="rtl:rotate-180" aria-hidden />
          {t('Back to COD', 'العودة إلى COD')}
        </Link>
      </Button>

      <PageHeader
        title={`COD · ${orderLabel}`}
        description={record.company?.name ?? undefined}
        actions={
          <div className="min-w-44 space-y-1.5" onClick={(e) => e.stopPropagation()}>
            <Label htmlFor="cod-detail-status">{t('Status', 'الحالة')}</Label>
            <Select
              value={record.status}
              disabled={statusMut.isPending}
              onValueChange={(next) => {
                const status = next as CodRecordStatus
                if (status === record.status) return
                statusMut.mutate(status)
              }}
            >
              <SelectTrigger id="cod-detail-status" className="w-full font-semibold">
                <SelectValue>
                  <StatusBadge tone={COD_STATUS_TONE[record.status]}>{codStatusLabel(record.status, isArabic)}</StatusBadge>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {COD_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    <StatusBadge tone={COD_STATUS_TONE[opt]}>{codStatusLabel(opt, isArabic)}</StatusBadge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Banknote className="size-4 text-primary" aria-hidden />
              {t('Record', 'السجل')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('Status', 'الحالة')} value={<StatusBadge tone={COD_STATUS_TONE[record.status]}>{codStatusLabel(record.status, isArabic)}</StatusBadge>} />
              <Field label={t('Currency', 'العملة')} value={record.currency || '—'} />
              <Field label={t('Original amount', 'المبلغ الأصلي')} value={fmtMoney(record.originalAmount, record.currency)} />
              <Field
                label={t('Current amount', 'المبلغ الحالي')}
                value={<span className="font-semibold">{fmtMoney(record.currentAmount, record.currency)}</span>}
              />
              <Field label={t('Available at', 'متاح في')} value={formatDateTime(record.availableAt, locale)} />
              <Field label={t('Paid out at', 'صُرف في')} value={formatDateTime(record.paidOutAt, locale)} />
              <Field label={t('Created', 'تاريخ الإنشاء')} value={formatDateTime(record.createdAt, locale)} />
              <Field label={t('Updated', 'آخر تحديث')} value={formatDateTime(record.updatedAt, locale)} />
            </div>
            {record.notes?.trim() ? (
              <div className="mt-4">
                <Field label={t('Notes', 'ملاحظات')} value={record.notes} />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('Order & client', 'الطلب والعميل')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label={t('Order', 'الطلب')}
                value={
                  <Link to={`/orders/oms/${record.omsOrderId}`} className="font-medium text-primary hover:underline">
                    {orderLabel}
                  </Link>
                }
              />
              <Field label={t('Order status', 'حالة الطلب')} value={record.omsOrder?.status?.replace(/_/g, ' ') ?? '—'} />
              <Field label={t('Client', 'العميل')} value={record.company?.name ?? '—'} />
              <Field label={t('Recipient', 'المستلم')} value={record.omsOrder?.recipientName?.trim() || '—'} />
              <Field label={t('Payment method', 'طريقة الدفع')} value={record.omsOrder?.paymentMethod ?? '—'} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b">
          <CardTitle className="text-base">{t('Adjustments', 'التعديلات')}</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <DataTable<CodRecordAdjustment>
            columns={adjustmentCols}
            data={record.adjustments}
            getRowId={(row) => row.id}
            empty={t('No adjustments on this COD record.', 'لا توجد تعديلات على سجل COD هذا.')}
          />
        </CardContent>
      </Card>
    </div>
  )
}
