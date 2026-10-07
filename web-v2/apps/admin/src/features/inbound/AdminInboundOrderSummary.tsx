import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, formatDateTime, useUiPreferences } from '@emdad/core'
import { StatusBadge } from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@emdad/ui/ui/card'
import type { InboundOrder } from '@/api/inbound'
import { InboundApi } from '@/api/inbound'
import { LocationsApi } from '@/api/locations'
import { WorkflowsApi } from '@/api/workflows'
import { QK } from '@/constants/query-keys'
import {
  inboundAdminPlanIsComplete,
  isAdminExecutionMode,
  normalizeExecutionMode,
} from '@/lib/execution-plan'
import { invalidateWorkflowTasksInventory } from '@/lib/invalidate-wms-queries'
import { openInboundInstructionsPdf } from '@/lib/order-instructions-print'
import { InboundStatusBadge } from './inbound-ui'

type Props = { order: InboundOrder }

function fmtQty(s: string | number): string {
  const n = Number(s)
  if (Number.isFinite(n)) return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
  return String(s)
}

function Field({ label, value, className, preWrap }: { label: string; value?: ReactNode; className?: string; preWrap?: boolean }) {
  return (
    <div className={className}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-sm ${preWrap ? 'whitespace-pre-wrap' : ''}`}>{value ?? '—'}</div>
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
  return useMemo(() => {
    const map = new Map<string, string>()
    unique.forEach((id, i) => {
      const loc = queries[i]?.data
      map.set(id, loc?.fullPath?.trim() || id)
    })
    return map
  }, [unique, queries])
}

function taskHref(taskId: string, companyId: string): string {
  return `/tasks/${taskId}?companyId=${encodeURIComponent(companyId)}`
}

export function AdminInboundOrderSummary({ order }: Props) {
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const qc = useQueryClient()
  const mode = normalizeExecutionMode(order.executionMode)
  const isAdminMode = isAdminExecutionMode(order.executionMode)
  const hasReceived = order.lines.some((l) => Number(l.receivedQuantity) > 0)
  const isWaitingApproval = order.status === 'draft' || order.status === 'pending_approval'
  const isPlannable = isWaitingApproval
  const plan = order.executionPlan
  const [printedAt, setPrintedAt] = useState<string | null>(null)

  const planReady = useMemo(() => inboundAdminPlanIsComplete(plan, order.lines), [order.lines, plan])
  const printStale = printedAt != null && plan?.planUpdatedAt != null && plan.planUpdatedAt !== printedAt

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
  const locationLabels = useMemo(() => {
    const labels: Record<string, string> = {}
    for (const id of locationIds) labels[id] = locationById.get(id) ?? id
    return labels
  }, [locationIds, locationById])

  const timeline = useQuery({
    queryKey: QK.workflows.timeline('inbound_order', order.id),
    queryFn: () => WorkflowsApi.getTimeline('inbound_order', order.id, order.companyId),
    enabled: !isWaitingApproval,
  })

  const openTasks = (timeline.data?.tasks ?? []).filter(
    (task) => task.status === 'pending' || task.status === 'assigned' || task.status === 'in_progress',
  )
  const hasOpenReceiving = openTasks.some((task) => task.taskType === 'receiving')
  const hasOpenPutaway = openTasks.some((task) => task.taskType === 'putaway' || task.taskType === 'putaway_quarantine')

  type AdminStageAction = 'approve' | 'complete_receiving' | 'complete_putaway' | 'release'

  const adminStageAction: AdminStageAction | null = useMemo(() => {
    if (order.status === 'completed' || order.status === 'cancelled') return null
    if (!isAdminMode) {
      return isWaitingApproval ? 'release' : null
    }
    if (isWaitingApproval) return 'approve'
    if (hasOpenReceiving || (!hasReceived && (order.status === 'in_progress' || order.status === 'confirmed'))) {
      return 'complete_receiving'
    }
    if (hasOpenPutaway || hasReceived) {
      return 'complete_putaway'
    }
    return null
  }, [hasOpenPutaway, hasOpenReceiving, hasReceived, isAdminMode, isWaitingApproval, order.status])

  const stageMut = useMutation({
    mutationFn: async () => {
      if (adminStageAction === 'release') {
        if (!planReady || !plan) throw new Error(t('Complete the warehouse plan first.', 'أكمل خطة المستودع أولاً.'))
        const stagingByLineId: Record<string, string> = {}
        for (const line of order.lines) {
          stagingByLineId[line.id] = plan.receivingDockId
        }
        return InboundApi.confirm(
          order.id,
          { warehouseId: plan.warehouseId, stagingByLineId },
          order.companyId,
        )
      }
      if (adminStageAction === 'approve') {
        if (!planReady || !plan) throw new Error(t('Complete the warehouse plan first.', 'أكمل خطة المستودع أولاً.'))
        return InboundApi.approve(order.id, order.companyId)
      }
      if (adminStageAction === 'complete_receiving') {
        return InboundApi.completeReceiving(order.id, order.companyId)
      }
      if (adminStageAction === 'complete_putaway') {
        return InboundApi.completePutaway(order.id, order.companyId)
      }
      throw new Error(t('No stage action available.', 'لا يوجد إجراء مرحلة متاح.'))
    },
    onSuccess: () => {
      const messages: Record<AdminStageAction, string> = {
        approve: t('Order approved. Waiting for receiving.', 'تمت الموافقة. بانتظار الاستلام.'),
        complete_receiving: t('Receiving marked complete.', 'تم تأكيد اكتمال الاستلام.'),
        complete_putaway: t('Putaway marked complete.', 'تم تأكيد اكتمال التخزين.'),
        release: t('Released to workers. Tasks are ready.', 'تم الإطلاق للعمال. المهام جاهزة.'),
      }
      if (adminStageAction) toast.success(messages[adminStageAction])
      void qc.invalidateQueries({ queryKey: [...QK.inboundOrders, order.id] })
      void qc.invalidateQueries({ queryKey: QK.inboundOrders })
      invalidateWorkflowTasksInventory(qc, {
        referenceId: order.id,
        referenceType: 'inbound_order',
      })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const stageCtaLabel =
    adminStageAction === 'approve'
      ? t('Approve', 'موافقة')
      : adminStageAction === 'complete_receiving'
        ? t('Mark receiving complete', 'تأكيد اكتمال الاستلام')
        : adminStageAction === 'complete_putaway'
          ? t('Mark putaway complete', 'تأكيد اكتمال التخزين')
          : adminStageAction === 'release'
            ? t('Release to workers', 'إطلاق للعمال')
            : null

  const statusDisplayLabel =
    order.status === 'pending_approval'
      ? t('Waiting for approval', 'بانتظار الموافقة')
      : adminStageAction === 'complete_receiving'
        ? t('Waiting for receiving', 'بانتظار الاستلام')
        : adminStageAction === 'complete_putaway'
          ? t('Waiting for putaway', 'بانتظار التخزين')
          : null

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-xl font-semibold">{order.orderNumber || order.id}</h1>
            {isWaitingApproval ? (
              <StatusBadge tone="warning">
                {order.status === 'pending_approval' ? t('Waiting for approval', 'بانتظار الموافقة') : t('Planned', 'مخطط')}
              </StatusBadge>
            ) : statusDisplayLabel ? (
              <StatusBadge tone="warning">{statusDisplayLabel}</StatusBadge>
            ) : (
              <InboundStatusBadge status={order.status} isArabic={isArabic} />
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdminMode
              ? t('Review plan, then complete receiving and putaway explicitly.', 'راجع الخطة، ثم أكمل الاستلام والتخزين صراحةً.')
              : t('Complete the plan, then release work to warehouse workers.', 'أكمل الخطة، ثم أطلِق العمل لعمال المستودع.')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isPlannable ? (
            <Button variant="outline" asChild>
              <Link to={`/orders/inbound/${order.id}/edit`}>{planReady ? t('Edit plan', 'تعديل الخطة') : t('Complete plan', 'إكمال الخطة')}</Link>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!openInboundInstructionsPdf(order, locationLabels)) {
                toast.error(t('Allow pop-ups to print.', 'اسمح بالنوافذ المنبثقة للطباعة.'))
                return
              }
              setPrintedAt(plan?.planUpdatedAt ?? new Date().toISOString())
            }}
          >
            {t('Print instructions', 'طباعة التعليمات')}
          </Button>
          {stageCtaLabel ? (
            <Button
              type="button"
              disabled={
                stageMut.isPending || ((adminStageAction === 'approve' || adminStageAction === 'release') && !planReady)
              }
              title={
                (adminStageAction === 'approve' || adminStageAction === 'release') && !planReady
                  ? t('Complete the warehouse plan (dock + putaway) first.', 'أكمل خطة المستودع (الرصيف + التخزين) أولاً.')
                  : undefined
              }
              onClick={() => stageMut.mutate()}
            >
              {stageMut.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {stageCtaLabel}
            </Button>
          ) : null}
        </div>
      </div>

      {isPlannable && !planReady ? (
        <Alert>
          <AlertTitle>{t('Warehouse plan incomplete', 'خطة المستودع غير مكتملة')}</AlertTitle>
          <AlertDescription>
            {t('Open Complete plan, then Approve or Release.', 'افتح إكمال الخطة، ثم وافق أو أطلِق.')}
          </AlertDescription>
        </Alert>
      ) : null}

      {printStale ? (
        <Alert>
          <AlertTitle>{t('Plan changed since last print', 'تغيّرت الخطة منذ آخر طباعة')}</AlertTitle>
          <AlertDescription>
            {t('Print again before physical work.', 'اطبع من جديد قبل العمل الفعلي.')}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t('Order details', 'تفاصيل الطلب')}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <Field label={t('Order #', 'رقم الطلب')} value={order.orderNumber || order.id} />
            <Field
              label={t('Number of SKUs', 'عدد SKU')}
              value={String(new Set(order.lines.map((line) => line.product?.sku || line.productId)).size)}
            />
            <Field label={t('Expected arrival', 'تاريخ الوصول المتوقع')} value={formatDate(order.expectedArrivalDate, locale)} />
            <Field label={t('Created', 'تاريخ الإنشاء')} value={formatDateTime(order.createdAt, locale)} />
            <Field label={t('Client', 'العميل')} value={order.company?.name ?? '—'} />
            <Field label={t('Execution', 'التنفيذ')} value={mode === 'admin' ? t('Admin', 'مسؤول') : t('Workers', 'عمال')} />
            {order.confirmedAt ? <Field label={t('Confirmed', 'مؤكد')} value={formatDateTime(order.confirmedAt, locale)} /> : null}
            {order.completedAt ? <Field label={t('Completed', 'مكتمل')} value={formatDateTime(order.completedAt, locale)} /> : null}
            <Field label={t('Notes', 'ملاحظات')} value={order.notes?.trim() || '—'} className="sm:col-span-2" preWrap />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('Line items', 'بنود الطلب')}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs font-semibold uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-start">#</th>
                <th className="px-4 py-2.5 text-start">{t('Image', 'صورة')}</th>
                <th className="px-4 py-2.5 text-start">{t('Product', 'المنتج')}</th>
                <th className="px-4 py-2.5 text-start">SKU</th>
                <th className="px-4 py-2.5 text-end">{t('Expected', 'المطلوب')}</th>
                <th className="px-4 py-2.5 text-end">{t('Received', 'المستلم')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {order.lines.map((line) => {
                const imageSrc = productImageSrc(line.product?.imagePath)
                return (
                  <tr key={line.id}>
                    <td className="px-4 py-2.5 text-muted-foreground">{line.lineNumber}</td>
                    <td className="px-4 py-2.5">
                      {imageSrc ? (
                        <img src={imageSrc} alt="" className="size-10 rounded-lg border object-cover" />
                      ) : (
                        <div className="flex size-10 items-center justify-center rounded-lg border bg-muted text-muted-foreground text-xs">—</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-medium">{line.product?.name ?? '—'}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{line.product?.sku ?? '—'}</td>
                    <td className="px-4 py-2.5 text-end tabular">{fmtQty(line.expectedQuantity)}</td>
                    <td className="px-4 py-2.5 text-end font-semibold tabular">{fmtQty(line.receivedQuantity)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('Warehouse plan', 'خطة المستودع')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            label={t('Receiving dock', 'رصيف الاستلام')}
            value={plan?.receivingDockId ? (locationById.get(plan.receivingDockId) ?? plan.receivingDockId) : '—'}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs font-semibold uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 pe-3 text-start">SKU</th>
                  <th className="py-2 pe-3 text-start">{t('Product', 'المنتج')}</th>
                  <th className="py-2 text-start">{t('Putaway', 'التخزين')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {order.lines.map((l) => {
                  const pl =
                    plan?.lines.find((x) => x.orderLineId === l.id) ?? plan?.lines.find((x) => x.productId === l.productId)
                  return (
                    <tr key={l.id}>
                      <td className="py-2 pe-3 font-mono text-xs text-muted-foreground">{l.product?.sku ?? '—'}</td>
                      <td className="py-2 pe-3 font-medium">{l.product?.name ?? '—'}</td>
                      <td className="py-2">
                        {(pl?.putaway ?? []).length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          (pl?.putaway ?? []).map((s, i) => (
                            <div key={i} className="text-sm">
                              {locationById.get(s.locationId) ?? s.locationId} × {s.qty}
                            </div>
                          ))
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {!isPlannable && openTasks.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('Open warehouse tasks', 'مهام المستودع المفتوحة')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {isAdminMode
                ? t('Stage actions above complete the current open task.', 'إجراءات المرحلة أعلاه تكمل المهمة المفتوحة.')
                : t('Monitor only — workers execute on the Tasks page.', 'مراقبة فقط — العمال ينفّذون من صفحة المهام.')}
            </p>
            <ul className="space-y-1 text-sm">
              {openTasks.map((task) => (
                <li key={task.id}>
                  <Link to={taskHref(task.id, order.companyId)} className="font-medium text-primary hover:underline">
                    {task.taskType} · {task.status}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {isPlannable ? (
        <Alert>
          <AlertTitle>{isAdminMode ? t('Staged admin execution', 'تنفيذ مسؤول على مراحل') : t('After release', 'بعد الإطلاق')}</AlertTitle>
          <AlertDescription>
            {isAdminMode
              ? t(
                  'Approve starts receiving only. Mark receiving complete, then mark putaway complete — each stage separately.',
                  'الموافقة تبدأ الاستلام فقط. أكد الاستلام ثم التخزين — كل مرحلة على حدة.',
                )
              : t(
                  'Release starts the workflow. Workers complete tasks on /tasks.',
                  'الإطلاق يبدأ سير العمل. العمال يكملون المهام من /tasks.',
                )}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
