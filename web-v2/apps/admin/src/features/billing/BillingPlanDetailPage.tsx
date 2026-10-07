import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowLeft } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import { ConfirmDialog, DataTable, PageHeader, StatusBadge, useNavigate } from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { Card, CardContent } from '@emdad/ui/ui/card'
import { Skeleton } from '@emdad/ui/ui/skeleton'
import { toast } from 'sonner'
import { BillingApi, type BillingCycleRow, type BillingInvoiceRow } from '@/api/billing'
import { useAuth } from '@/auth/AuthContext'
import { QK } from '@/constants/query-keys'
import { daysRemainingFromEnd, formatDate, formatDecimal } from '@/lib/billing-plan-overview'
import { VolumeAllocationPanel } from './VolumeAllocationPanel'
import {
  BILLING_CURRENCY,
  CycleStatusBadge,
  DetailField,
  InvoiceStatusBadge,
  PlanActiveBadge,
  cycleStatusLabel,
  canMutateBilling,
} from './billing-ui'

function pendingSummary(pending: Record<string, unknown> | null | undefined, isArabic: boolean): string[] {
  if (!pending || typeof pending !== 'object') return []
  const lines: string[] = []
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  if (pending.reservedVolume != null) {
    lines.push(`${t('Reserved volume', 'الحجم المحجوز')} → ${formatDecimal(String(pending.reservedVolume), 2)} m³`)
  }
  if (pending.fixedSubscriptionFee != null) {
    lines.push(`${t('Price', 'السعر')} → ${formatDecimal(String(pending.fixedSubscriptionFee))} ${BILLING_CURRENCY}`)
  }
  if (pending.cycleLengthDays != null) {
    lines.push(`${t('Billing cycle', 'دورة الفوترة')} → ${pending.cycleLengthDays} ${t('days', 'يوم')}`)
  }
  return lines
}

export function BillingPlanDetailPage() {
  const { clientId = '' } = useParams<{ clientId: string }>()
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const canMutate = canMutateBilling(user?.role)
  const [renewOpen, setRenewOpen] = useState(false)

  const detailQuery = useQuery({
    queryKey: QK.billing.planDetail(clientId),
    queryFn: () => BillingApi.getPlanDetailByClient(clientId),
    enabled: !!clientId,
  })

  const capacityQuery = useQuery({
    queryKey: QK.billing.capacity,
    queryFn: () => BillingApi.getCapacitySummary(),
    enabled: canMutate,
  })

  const storageQuery = useQuery({
    queryKey: [...QK.billing.capacity, 'company', clientId],
    queryFn: () => BillingApi.getCompanyStorage(clientId),
    enabled: canMutate && !!clientId,
  })

  const company = detailQuery.data?.company
  const plan = detailQuery.data?.plan ?? null
  const currentCycle = detailQuery.data?.currentCycle ?? null
  const cycles = detailQuery.data?.cycles ?? []
  const invoices = detailQuery.data?.invoices ?? []
  const daysLeft = currentCycle ? daysRemainingFromEnd(currentCycle.endsAt) : null
  const pendingLines = pendingSummary(plan?.pendingChanges as Record<string, unknown> | null, isArabic)
  const isRestricted = company?.status === 'restricted'
  const canRenew =
    !!plan &&
    (isRestricted ||
      currentCycle?.status === 'active' ||
      !currentCycle ||
      currentCycle.status === 'expired')

  const renewMut = useMutation({
    mutationFn: () => BillingApi.renewPlan(plan!.id),
    onSuccess: (result) => {
      toast.success(
        result.mode === 'reactivated'
          ? t('Plan renewed.', 'تم تجديد الخطة.')
          : t('Marked for renewal.', 'تم جدولة التجديد.'),
      )
      void qc.invalidateQueries({ queryKey: QK.billing.planDetail(clientId) })
      void qc.invalidateQueries({ queryKey: QK.billing.plans })
      setRenewOpen(false)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const cycleColumns = useMemo<ColumnDef<BillingCycleRow>[]>(
    () => [
      { header: t('Start', 'البداية'), accessorKey: 'startsAt', cell: ({ row }) => formatDate(row.original.startsAt) },
      { header: t('End', 'النهاية'), accessorKey: 'endsAt', cell: ({ row }) => formatDate(row.original.endsAt) },
      {
        header: t('Status', 'الحالة'),
        cell: ({ row }) => <CycleStatusBadge status={row.original.status} isArabic={isArabic} />,
      },
    ],
    [isArabic, t],
  )

  const invoiceColumns = useMemo<ColumnDef<BillingInvoiceRow>[]>(
    () => [
      {
        header: t('Invoice #', 'رقم الفاتورة'),
        cell: ({ row }) => (
          <span className="font-mono text-sm font-semibold text-primary" dir="ltr">
            {row.original.invoiceNumber}
          </span>
        ),
        meta: { priority: 1 },
      },
      {
        header: t('Amount', 'المبلغ'),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatDecimal(row.original.grandTotal ?? row.original.totalAmount)} {BILLING_CURRENCY}
          </span>
        ),
        meta: { priority: 2 },
      },
      {
        header: t('Issued', 'تاريخ الإصدار'),
        cell: ({ row }) => formatDate(row.original.issuedAt ?? row.original.createdAt),
        meta: { priority: 3 },
      },
      {
        header: t('Status', 'الحالة'),
        cell: ({ row }) => <InvoiceStatusBadge status={row.original.status} isArabic={isArabic} />,
        meta: { priority: 2 },
      },
    ],
    [isArabic, t],
  )

  return (
    <div className="space-y-5">
      <Link
        to="/billing/plans"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {t('Back to billing plans', 'العودة إلى الخطط')}
      </Link>

      <PageHeader
        title={company ? `${company.name} — ${t('billing plan', 'خطة الفوترة')}` : t('Client billing plan', 'خطة العميل')}
        description={t('Subscription plan, cycle, history, and invoices.', 'الخطة والدورة والسجل والفواتير.')}
        actions={
          canMutate ? (
            <div className="flex flex-wrap gap-2">
              {!plan ? (
                <Button onClick={() => navigate('/billing/plans/new')}>{t('Create plan', 'إنشاء خطة')}</Button>
              ) : (
                <>
                  {canRenew ? (
                    <Button onClick={() => setRenewOpen(true)}>{t('Renew', 'تجديد')}</Button>
                  ) : null}
                  <Button variant="outline" onClick={() => navigate(`/billing/plans/${clientId}/edit`)}>
                    {t('Edit plan', 'تعديل الخطة')}
                  </Button>
                </>
              )}
            </div>
          ) : undefined
        }
      />

      {detailQuery.isPending ? (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-7 w-2/5" />
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      ) : null}

      {detailQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>{t('Could not load details', 'تعذر التحميل')}</AlertTitle>
          <AlertDescription>{(detailQuery.error as Error).message}</AlertDescription>
        </Alert>
      ) : null}

      {!plan && !detailQuery.isPending ? (
        <div className="rounded-xl border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">{t('This client has no billing plan yet.', 'لا توجد خطة لهذا العميل.')}</p>
          {canMutate ? (
            <Button className="mt-3" onClick={() => navigate('/billing/plans/new')}>
              {t('Create billing plan', 'إنشاء خطة')}
            </Button>
          ) : null}
        </div>
      ) : null}

      {plan ? (
        <>
          {pendingLines.length > 0 ? (
            <Alert>
              <AlertTitle>{t('Pending changes (next cycle)', 'تغييرات معلّقة (الدورة التالية)')}</AlertTitle>
              <AlertDescription>
                <ul className="mt-1 list-disc ps-5">
                  {pendingLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}

          <VolumeAllocationPanel
            capacity={capacityQuery.data}
            storage={storageQuery.data}
            reservedVolume={plan.reservedVolume}
            loading={storageQuery.isLoading || capacityQuery.isLoading}
            title={t('Client storage', 'تخزين العميل')}
          />

          <section className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">{t('Current plan', 'الخطة الحالية')}</h3>
              <PlanActiveBadge active={plan.active} isArabic={isArabic} />
              {isRestricted ? (
                <StatusBadge tone="danger">{t('Restricted', 'مقيّد')}</StatusBadge>
              ) : null}
            </div>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField label={t('Client', 'العميل')} value={company?.name ?? '—'} />
              <DetailField
                label={t('Plan type', 'نوع الخطة')}
                value={
                  plan.planType === 'template'
                    ? `${t('Template', 'قالب')}${plan.templateName ? ` · ${plan.templateName}` : ''}`
                    : t('Custom', 'مخصص')
                }
              />
              <DetailField label={t('Reserved volume', 'الحجم المحجوز')} value={`${formatDecimal(plan.reservedVolume, 2)} m³`} />
              <DetailField
                label={t('Fixed plan price', 'سعر الخطة')}
                value={`${formatDecimal(plan.fixedSubscriptionFee)} ${BILLING_CURRENCY}`}
              />
              <DetailField
                label={t('Inbound order price', 'سعر الوارد')}
                value={`${formatDecimal(plan.inboundOrderFee)} ${BILLING_CURRENCY}`}
              />
              <DetailField
                label={t('Outbound order price', 'سعر الصادر')}
                value={`${formatDecimal(plan.outboundOrderFee)} ${BILLING_CURRENCY}`}
              />
              <DetailField label={t('Billing cycle', 'دورة الفوترة')} value={`${plan.cycleLengthDays} ${t('days', 'يوم')}`} />
              <DetailField
                label={t('Auto-renewal', 'تجديد تلقائي')}
                value={plan.autoRenew === false ? t('Off', 'إيقاف') : t('On', 'تشغيل')}
              />
              <DetailField label={t('Created', 'تاريخ الإنشاء')} value={formatDate(plan.createdAt)} />
            </dl>
          </section>

          <section className="rounded-xl border bg-card p-4 shadow-sm">
            <h3 className="text-sm font-semibold">{t('Current billing cycle', 'دورة الفوترة الحالية')}</h3>
            {currentCycle ? (
              <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <DetailField label={t('Start', 'البداية')} value={formatDate(currentCycle.startsAt)} />
                <DetailField label={t('End', 'النهاية')} value={formatDate(currentCycle.endsAt)} />
                <DetailField label={t('Next renewal', 'التجديد التالي')} value={formatDate(currentCycle.endsAt)} />
                <DetailField
                  label={t('Days remaining', 'الأيام المتبقية')}
                  value={
                    daysLeft != null && daysLeft > 0
                      ? `${daysLeft} ${t('days', 'يوم')}`
                      : daysLeft === 0
                        ? t('Last day', 'آخر يوم')
                        : t('Expired', 'منتهية')
                  }
                />
                <DetailField
                  label={t('Cycle status', 'حالة الدورة')}
                  value={cycleStatusLabel(currentCycle.status, isArabic)}
                />
              </dl>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">{t('No active billing cycle.', 'لا توجد دورة نشطة.')}</p>
            )}
          </section>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">{t('Cycle history', 'سجل الدورات')}</h3>
            <DataTable
              columns={cycleColumns}
              data={cycles}
              getRowId={(r) => r.id}
              empty={t('No billing cycles yet.', 'لا دورات بعد.')}
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">{t('Recent invoices', 'الفواتير الأخيرة')}</h3>
            <DataTable
              columns={invoiceColumns}
              data={invoices}
              getRowId={(r) => r.id}
              onRowClick={(r) => navigate(`/billing/invoices/${r.id}`)}
              empty={t('No invoices yet.', 'لا فواتير بعد.')}
            />
          </div>
        </>
      ) : null}

      <ConfirmDialog
        open={renewOpen}
        onOpenChange={setRenewOpen}
        title={t('Renew billing plan?', 'تجديد خطة الفوترة؟')}
        description={t(
          'This may restore access or mark the cycle for renewal when it expires.',
          'قد يستعيد الوصول أو يجدول التجديد عند انتهاء الدورة.',
        )}
        confirmLabel={t('Renew', 'تجديد')}
        cancelLabel={t('Cancel', 'إلغاء')}
        loading={renewMut.isPending}
        onConfirm={() => renewMut.mutate()}
      />
    </div>
  )
}
