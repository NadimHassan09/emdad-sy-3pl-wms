import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, type ReactNode } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { formatDateTime, useUiPreferences } from '@emdad/core'
import { ErrorState, PageHeader, StatusBadge, type Tone } from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@emdad/ui/ui/card'
import { Skeleton } from '@emdad/ui/ui/skeleton'
import { OmsReturnsApi, type OmsReturn, type OmsReturnStatus } from '@/api/oms'
import { LocationsApi } from '@/api/locations'
import { QK } from '@/constants/query-keys'
import {
  inboundAdminPlanIsComplete,
  isAdminExecutionMode,
  normalizeExecutionMode,
} from '@/lib/execution-plan'

const RETURN_TONE: Record<OmsReturnStatus, Tone> = {
  requested: 'pending',
  approved: 'progress',
  rejected: 'danger',
  completed: 'success',
  cancelled: 'neutral',
}

function fmtQty(s: string | number): string {
  const n = Number(s)
  if (Number.isFinite(n)) return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
  return String(s)
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm whitespace-pre-wrap">{value ?? '—'}</div>
    </div>
  )
}

function productImageSrc(imagePath?: string | null): string | null {
  if (!imagePath?.trim()) return null
  return `/api/client/media/${imagePath.replace(/^\/+/, '')}`
}

function useLocationLabels(ids: string[]) {
  const unique = useMemo(() => [...new Set(ids.filter(Boolean))], [ids])
  const queries = useQueries({
    queries: unique.map((id) => ({
      queryKey: QK.locations.byId(id),
      queryFn: () => LocationsApi.getById(id),
      staleTime: 60_000,
    })),
  })
  const locationById = useMemo(() => {
    const map = new Map<string, string>()
    unique.forEach((id, i) => {
      const loc = queries[i]?.data
      map.set(id, loc?.fullPath?.trim() || id)
    })
    return map
  }, [unique, queries])
  return locationById
}

function ReturnBody({ omsReturn }: { omsReturn: OmsReturn }) {
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const qc = useQueryClient()

  const mode = normalizeExecutionMode(omsReturn.executionMode)
  const isAdminMode = isAdminExecutionMode(omsReturn.executionMode)
  const isWaitingApproval = omsReturn.status === 'requested'
  const plan = omsReturn.executionPlan

  const planReady = useMemo(
    () =>
      inboundAdminPlanIsComplete(
        plan,
        omsReturn.lines.map((l) => ({
          id: l.id,
          productId: l.productId,
          expectedQuantity: l.quantity,
        })),
      ),
    [omsReturn.lines, plan],
  )

  const locationIds = useMemo(() => {
    const ids: string[] = []
    if (plan?.receivingDockId) ids.push(plan.receivingDockId)
    for (const line of plan?.lines ?? []) {
      for (const split of line.putaway ?? []) {
        if (split.locationId) ids.push(split.locationId)
      }
    }
    return ids
  }, [plan])

  const locationById = useLocationLabels(locationIds)
  const adminStageAction = omsReturn.nextAdminAction ?? null

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: QK.omsReturns })
    void qc.invalidateQueries({ queryKey: QK.omsReturn(omsReturn.id) })
  }

  const confirmReturnMut = useMutation({
    mutationFn: () => OmsReturnsApi.confirmReturn(omsReturn.id),
    onSuccess: () => {
      toast.success(
        t(
          'Return confirmed and restocked in Returns location.',
          'تم تأكيد واستلام الإرجاع بنجاح في قسم المرتجعات.',
        ),
      )
      invalidate()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const stageMut = useMutation({
    mutationFn: async () => {
      if (adminStageAction === 'approve') {
        return OmsReturnsApi.approve(omsReturn.id, plan?.warehouseId)
      }
      if (adminStageAction === 'complete_receiving') {
        return OmsReturnsApi.completeReceiving(omsReturn.id)
      }
      if (adminStageAction === 'complete_putaway') {
        return OmsReturnsApi.completePutaway(omsReturn.id)
      }
      throw new Error(t('No stage action available.', 'لا يوجد إجراء مرحلة متاح.'))
    },
    onSuccess: () => {
      const messages = {
        approve: t('Return approved. Waiting for receiving.', 'تمت الموافقة على المرتجع. بانتظار الاستلام.'),
        complete_receiving: t('Receiving marked complete.', 'تم تأكيد الاستلام في المستودع.'),
        complete_putaway: t('Putaway marked complete.', 'تم تخزين المرتجع بنجاح.'),
      } as const
      if (adminStageAction) toast.success(messages[adminStageAction])
      invalidate()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const rejectMut = useMutation({
    mutationFn: () => OmsReturnsApi.reject(omsReturn.id),
    onSuccess: () => {
      toast.success(t('Return rejected.', 'تم رفض المرتجع.'))
      invalidate()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const stageCtaLabel =
    adminStageAction === 'approve'
      ? t('Approve', 'موافقة')
      : adminStageAction === 'complete_receiving'
        ? t('Mark receiving complete', 'إتمام الاستلام')
        : adminStageAction === 'complete_putaway'
          ? t('Mark putaway complete', 'إتمام التخزين')
          : null

  const statusDisplayLabel =
    isWaitingApproval && !planReady
      ? t('Plan incomplete', 'الخطة غير مكتملة')
      : isWaitingApproval && planReady
        ? t('Waiting for approval', 'بانتظار الموافقة')
        : adminStageAction === 'complete_receiving'
          ? t('Waiting for receiving', 'بانتظار الاستلام')
          : adminStageAction === 'complete_putaway'
            ? t('Waiting for putaway', 'بانتظار التخزين')
            : null

  const whByProduct = useMemo(() => {
    const map = new Map<string, { received: string; expected: string; posted: string }>()
    for (const l of omsReturn.warehouseReturn?.lines ?? []) {
      map.set(l.productId, {
        received: l.receivedQuantity,
        expected: l.expectedQuantity,
        posted: l.postedQuantity,
      })
    }
    return map
  }, [omsReturn.warehouseReturn?.lines])

  return (
    <div className="space-y-5">
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-2 font-mono text-xl">
            {omsReturn.returnNumber || omsReturn.id}
            {statusDisplayLabel ? (
              <StatusBadge tone="warning">{statusDisplayLabel}</StatusBadge>
            ) : (
              <StatusBadge tone={RETURN_TONE[omsReturn.status]}>{omsReturn.status.replace(/_/g, ' ')}</StatusBadge>
            )}
          </span>
        }
        description={
          isAdminMode
            ? t(
                'Complete the plan, then approve, receive, and put away each stage separately.',
                'أكمل الخطة، ثم وافق واستلم وخزّن كل مرحلة على حدة.',
              )
            : t('Review the return and warehouse plan.', 'راجع المرتجع وخطة المستودع.')
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {isWaitingApproval ? (
              <Button variant="outline" size="sm" asChild>
                <Link to={`/oms/returns/${omsReturn.id}/edit`}>
                  {planReady ? t('Edit plan', 'تعديل الخطة') : t('Customize plan', 'تخصيص الخطة')}
                </Link>
              </Button>
            ) : null}
            {isWaitingApproval ? (
              <Button type="button" variant="outline" size="sm" disabled={rejectMut.isPending} onClick={() => rejectMut.mutate()}>
                {rejectMut.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {t('Reject', 'رفض')}
              </Button>
            ) : null}
            {isWaitingApproval ? (
              <Button type="button" size="sm" disabled={confirmReturnMut.isPending} onClick={() => confirmReturnMut.mutate()}>
                {confirmReturnMut.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {t('Confirm & restock', 'تأكيد واستلام')}
              </Button>
            ) : null}
            {stageCtaLabel && !isWaitingApproval ? (
              <Button type="button" size="sm" disabled={stageMut.isPending} onClick={() => stageMut.mutate()}>
                {stageMut.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {stageCtaLabel}
              </Button>
            ) : null}
          </div>
        }
      />

      {isWaitingApproval && !planReady ? (
        <Alert>
          <AlertTitle>{t('Default warehouse plan', 'خطة المستودع الافتراضية')}</AlertTitle>
          <AlertDescription>
            {t(
              'Confirm & restock uses the default Returns location when the plan is incomplete.',
              'تأكيد واستلام يستخدم موقع المرتجعات الافتراضي عندما تكون الخطة غير مكتملة.',
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t('Return details', 'تفاصيل المرتجع')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label={t('Return #', 'رقم المرتجع')} value={omsReturn.returnNumber || omsReturn.id} />
          <Field
            label={t('OMS order', 'طلب OMS')}
            value={
              omsReturn.omsOrder ? (
                <Link to={`/orders/oms/${omsReturn.omsOrderId}`} className="font-medium text-primary hover:underline">
                  {omsReturn.omsOrder.orderNumber}
                </Link>
              ) : (
                '—'
              )
            }
          />
          <Field label={t('Client', 'العميل')} value={omsReturn.company?.name ?? '—'} />
          <Field label={t('Execution', 'التنفيذ')} value={mode === 'admin' ? 'Admin' : 'Workers'} />
          <Field label={t('Created', 'تاريخ الإنشاء')} value={formatDateTime(omsReturn.createdAt, locale)} />
          {omsReturn.approvedAt ? (
            <Field label={t('Approved', 'تاريخ الموافقة')} value={formatDateTime(omsReturn.approvedAt, locale)} />
          ) : null}
          {omsReturn.completedAt ? (
            <Field label={t('Completed', 'تاريخ الإكمال')} value={formatDateTime(omsReturn.completedAt, locale)} />
          ) : null}
          {omsReturn.warehouseReturn ? (
            <Field
              label={t('Warehouse return', 'مرتجع المستودع')}
              value={
                <Link to={`/returns/${omsReturn.warehouseReturn.id}`} className="font-medium text-primary hover:underline">
                  {omsReturn.warehouseReturn.orderNumber}
                </Link>
              }
            />
          ) : null}
          <Field label={t('Reason', 'السبب')} value={omsReturn.reason?.trim() || '—'} />
          <Field label={t('Notes', 'ملاحظات')} value={omsReturn.notes?.trim() || '—'} />
        </CardContent>
      </Card>

      {plan ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('Warehouse plan', 'خطة المستودع')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t('Receiving area', 'منطقة الاستلام')}
                value={plan.receivingDockId ? locationById.get(plan.receivingDockId) : '—'}
              />
              <Field
                label={t('Plan updated', 'تحديث الخطة')}
                value={plan.planUpdatedAt ? formatDateTime(plan.planUpdatedAt, locale) : '—'}
              />
            </div>
            <div className="space-y-3">
              {(plan.lines ?? []).map((line) => {
                const sku =
                  omsReturn.lines.find((l) => l.productId === line.productId)?.product?.sku ?? line.productId
                return (
                  <div key={line.productId} className="text-sm">
                    <div className="font-medium">
                      {sku} · {t('qty', 'الكمية')} {fmtQty(line.expectedQty)}
                    </div>
                    <ul className="mt-1 list-inside list-disc text-muted-foreground">
                      {(line.putaway ?? []).map((p) => (
                        <li key={`${p.locationId}-${p.qty}`}>
                          {locationById.get(p.locationId) ?? p.locationId} — {fmtQty(p.qty)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t('Line items', 'البنود')}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-start">#</th>
                <th className="px-4 py-2.5 text-start">{t('Product', 'المنتج')}</th>
                <th className="px-4 py-2.5 text-start">SKU</th>
                <th className="px-4 py-2.5 text-end">{t('Return qty', 'كمية الإرجاع')}</th>
                <th className="px-4 py-2.5 text-end">{t('Received', 'مستلم')}</th>
                <th className="px-4 py-2.5 text-end">{t('Put away', 'مخزّن')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {omsReturn.lines.map((line) => {
                const imageSrc = productImageSrc(line.product?.imagePath)
                const wh = whByProduct.get(line.productId)
                return (
                  <tr key={line.id}>
                    <td className="px-4 py-2.5 text-muted-foreground">{line.lineNumber}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {imageSrc ? (
                          <img src={imageSrc} alt="" className="size-10 rounded-md border object-cover" loading="lazy" />
                        ) : null}
                        <span className="font-medium">{line.product?.name ?? '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{line.product?.sku ?? '—'}</td>
                    <td className="px-4 py-2.5 text-end tabular-nums">{fmtQty(line.quantity)}</td>
                    <td className="px-4 py-2.5 text-end tabular-nums">{wh ? fmtQty(wh.received) : '—'}</td>
                    <td className="px-4 py-2.5 text-end tabular-nums">{wh ? fmtQty(wh.posted) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

export function OmsReturnDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  const query = useQuery({
    queryKey: QK.omsReturn(id),
    queryFn: () => OmsReturnsApi.get(id),
    enabled: !!id,
  })

  if (!id) return null

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    )
  }

  if (query.isError || !query.data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="-ms-2 w-fit" asChild>
          <Link to="/oms/returns">
            <ArrowLeft className="rtl:rotate-180" aria-hidden />
            {t('All OMS returns', 'كل مرتجعات OMS')}
          </Link>
        </Button>
        <ErrorState title={t('Failed to load OMS return.', 'تعذر تحميل مرتجع OMS.')} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="-ms-2 w-fit" asChild>
        <Link to="/oms/returns">
          <ArrowLeft className="rtl:rotate-180" aria-hidden />
          {t('All OMS returns', 'كل مرتجعات OMS')}
        </Link>
      </Button>
      <ReturnBody omsReturn={query.data} />
    </div>
  )
}
