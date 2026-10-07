import { useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { useParams } from 'react-router'
import { useUiPreferences } from '@emdad/core'
import { ConfirmDialog, DataTable, PageHeader, useNavigate } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { Textarea } from '@emdad/ui/ui/textarea'
import {
  CycleCountApi,
  type CycleCountLine,
  type CycleCountVariance,
  type VarianceReasonCode,
} from '@/api/cycle-count'
import { useAuth } from '@/auth/AuthContext'
import { QK } from '@/constants/query-keys'
import { canExecuteCycleCount, isOperatorRole } from '@/lib/rbac'
import { CycleCountStatusBadge } from './cycle-count-ui'

const REASON_EN: Record<VarianceReasonCode, string> = {
  damaged: 'Damaged',
  lost: 'Lost',
  misplaced: 'Misplaced',
  theft_suspected: 'Theft suspected',
  counting_mistake: 'Counting mistake',
  operational_correction: 'Operational correction',
  unknown: 'Unknown',
}

export function CycleCountDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const isOperator = isOperatorRole(user?.role)
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  const [reviewTarget, setReviewTarget] = useState<CycleCountVariance | null>(null)
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve')
  const [reviewReason, setReviewReason] = useState<VarianceReasonCode>('unknown')
  const [reviewNotes, setReviewNotes] = useState('')

  const detail = useQuery({
    queryKey: QK.cycleCount.detail(id),
    queryFn: () => CycleCountApi.getCount(id),
    enabled: !!id,
  })

  const variances = useQuery({
    queryKey: QK.cycleCount.variances(id),
    queryFn: () => CycleCountApi.listCountVariances(id),
    enabled: !!id,
  })

  const reasonCodes = useQuery({
    queryKey: QK.cycleCount.reasonCodes,
    queryFn: () => CycleCountApi.listReasonCodes(),
    staleTime: 60 * 60_000,
  })

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: QK.cycleCount.detail(id) })
    void qc.invalidateQueries({ queryKey: QK.cycleCount.variances(id) })
    void qc.invalidateQueries({ queryKey: QK.cycleCount.all })
  }

  const completeMut = useMutation({
    mutationFn: () => CycleCountApi.complete(id),
    onSuccess: () => {
      toast.success(t('Cycle count completed.', 'اكتمل الجرد.'))
      invalidate()
      navigate('/cycle-count')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const reconcileMut = useMutation({
    mutationFn: () => CycleCountApi.buildReconciliation(id),
    onSuccess: () => {
      toast.success(t('Reconciliation draft created.', 'تم إنشاء مسودة التسوية.'))
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const postMut = useMutation({
    mutationFn: () => CycleCountApi.postReconciliation(id),
    onSuccess: (r) => {
      toast.success(t(`Posted ${r.variancesPosted} variance(s).`, `تم ترحيل ${r.variancesPosted} فرق.`))
      invalidate()
      void qc.invalidateQueries({ queryKey: QK.inventoryStock })
      void qc.invalidateQueries({ queryKey: QK.ledger })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const reviewMut = useMutation({
    mutationFn: () =>
      CycleCountApi.reviewVariance(reviewTarget!.id, {
        action: reviewAction,
        reasonCode: reviewReason,
        reviewNotes: reviewNotes.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(t('Variance updated.', 'تم تحديث الفرق.'))
      setReviewTarget(null)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const count = detail.data
  const canExecute =
    canExecuteCycleCount(user) && count && (count.status === 'scheduled' || count.status === 'in_progress')
  const canReconcile = count?.status === 'pending_review' && !isOperator
  const canComplete = count?.status === 'pending_review' && !isOperator

  const lineCols = useMemo<ColumnDef<CycleCountLine>[]>(
    () => [
      { id: 'product', header: t('Product', 'المنتج'), cell: ({ row }) => row.original.product.name },
      { id: 'sku', header: 'SKU', cell: ({ row }) => <span className="font-mono text-sm">{row.original.product.sku}</span> },
      { id: 'loc', header: t('Location', 'الموقع'), cell: ({ row }) => <span className="font-mono text-sm">{row.original.location.fullPath}</span> },
      { id: 'exp', header: t('Expected', 'المتوقع'), cell: ({ row }) => <span className="font-mono text-sm">{Number(row.original.expectedQuantity).toLocaleString()}</span> },
      {
        id: 'act',
        header: t('Actual', 'الفعلي'),
        cell: ({ row }) =>
          row.original.actualQuantity != null ? (
            <span className="font-mono text-sm">{Number(row.original.actualQuantity).toLocaleString()}</span>
          ) : (
            '—'
          ),
      },
      {
        id: 'var',
        header: t('Variance', 'الفرق'),
        cell: ({ row }) => {
          if (row.original.discrepancyQuantity == null) return '—'
          const n = Number(row.original.discrepancyQuantity)
          return (
            <span className={`font-mono text-sm ${n !== 0 ? 'font-semibold text-amber-700' : ''}`}>
              {n > 0 ? '+' : ''}
              {n.toLocaleString()}
            </span>
          )
        },
      },
      { id: 'ls', header: t('Line status', 'حالة البند'), cell: ({ row }) => <CycleCountStatusBadge status={row.original.status} isArabic={isArabic} /> },
    ],
    [isArabic, t],
  )

  const varianceCols = useMemo<ColumnDef<CycleCountVariance>[]>(
    () => [
      { id: 'sku', header: t('Product', 'المنتج'), cell: ({ row }) => row.original.product.sku },
      { id: 'loc', header: t('Location', 'الموقع'), cell: ({ row }) => row.original.location.fullPath },
      {
        id: 'disc',
        header: t('Variance', 'الفرق'),
        cell: ({ row }) => (
          <span className="font-mono text-sm font-semibold text-amber-700">
            {Number(row.original.discrepancyQuantity).toLocaleString()}
          </span>
        ),
      },
      { id: 'st', header: t('Status', 'الحالة'), cell: ({ row }) => <CycleCountStatusBadge status={row.original.status} isArabic={isArabic} /> },
      { id: 'reason', header: t('Reason', 'السبب'), cell: ({ row }) => (row.original.reasonCode ? REASON_EN[row.original.reasonCode] : '—') },
      {
        id: 'actions',
        header: t('Actions', 'إجراء'),
        cell: ({ row }) =>
          row.original.status === 'pending_review' && !isOperator ? (
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation()
                  setReviewTarget(row.original)
                  setReviewAction('approve')
                  setReviewReason('unknown')
                  setReviewNotes('')
                }}
              >
                {t('Approve', 'موافقة')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation()
                  setReviewTarget(row.original)
                  setReviewAction('reject')
                  setReviewReason('counting_mistake')
                  setReviewNotes('')
                }}
              >
                {t('Reject', 'رفض')}
              </Button>
            </div>
          ) : (
            '—'
          ),
      },
    ],
    [isArabic, isOperator, t],
  )

  if (detail.isLoading) {
    return <p className="text-sm text-muted-foreground">{t('Loading…', 'جاري التحميل…')}</p>
  }

  if (!count) {
    return <p className="text-sm text-destructive">{t('Cycle count not found.', 'الجرد غير موجود.')}</p>
  }

  return (
    <div className="space-y-4">
      <Button type="button" variant="ghost" className="px-0" onClick={() => navigate('/cycle-count')}>
        {t('Back to cycle counts', 'العودة إلى الجرد')}
      </Button>

      <PageHeader
        title={t('Cycle count', 'الجرد')}
        description={`${count.warehouse.code} · ${count.company.name}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {canExecute ? (
              <Button type="button" onClick={() => navigate(`/cycle-count/${id}/execute`)}>
                {t('Execute count', 'تنفيذ الجرد')}
              </Button>
            ) : null}
            {canReconcile ? (
              <>
                <Button type="button" variant="secondary" onClick={() => reconcileMut.mutate()} disabled={reconcileMut.isPending}>
                  {t('Build reconciliation', 'إنشاء تسوية')}
                </Button>
                <Button type="button" variant="secondary" onClick={() => postMut.mutate()} disabled={postMut.isPending}>
                  {t('Post reconciliation', 'ترحيل التسوية')}
                </Button>
              </>
            ) : null}
            {canComplete ? (
              <Button type="button" onClick={() => completeMut.mutate()} disabled={completeMut.isPending}>
                {t('Complete count', 'إكمال الجرد')}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label={t('Status', 'الحالة')} value={<CycleCountStatusBadge status={count.status} isArabic={isArabic} />} />
        <Kpi label={t('Lines', 'البنود')} value={String(count.lines.length)} />
        <Kpi label={t('Assigned', 'المكلف')} value={count.assignedWorker?.displayName ?? '—'} />
        <Kpi label={t('Snapshot', 'اللقطة')} value={count.snapshotAt ? new Date(count.snapshotAt).toLocaleString() : '—'} />
        <Kpi label={t('Interval', 'الفترة')} value={count.schedule?.intervalDays ? `${count.schedule.intervalDays}d` : '—'} />
        <Kpi label={t('Blind count', 'جرد أعمى')} value={count.blindCount ? t('Yes', 'نعم') : t('No', 'لا')} />
      </div>

      {(variances.data?.length ?? 0) > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">
            {t('Variances', 'الفروقات')} ({variances.data?.length})
          </h2>
          <DataTable<CycleCountVariance>
            columns={varianceCols}
            data={variances.data ?? []}
            getRowId={(r) => r.id}
            loading={variances.isLoading}
          />
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t('Count lines', 'بنود الجرد')}</h2>
        <DataTable<CycleCountLine> columns={lineCols} data={count.lines} getRowId={(r) => r.id} />
      </section>

      <ConfirmDialog
        open={!!reviewTarget}
        onOpenChange={(o) => !o && setReviewTarget(null)}
        title={reviewAction === 'approve' ? t('Approve variance', 'الموافقة على الفرق') : t('Reject variance', 'رفض الفرق')}
        confirmLabel={t('Confirm', 'تأكيد')}
        cancelLabel={t('Cancel', 'إلغاء')}
        loading={reviewMut.isPending}
        onConfirm={() => reviewMut.mutate()}
      >
        <div className="space-y-3 text-sm">
          <p>{t('Set reason code and optional notes.', 'حدد سبب الفرق وملاحظات اختيارية.')}</p>
          {reviewAction === 'approve' ? (
            <div className="space-y-1.5">
              <Label>{t('Reason code', 'رمز السبب')}</Label>
              <Select value={reviewReason} onValueChange={(v) => setReviewReason(v as VarianceReasonCode)}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(reasonCodes.data?.codes ?? []).map((c) => (
                    <SelectItem key={c} value={c}>
                      {REASON_EN[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label>{t('Notes', 'ملاحظات')}</Label>
            <Textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} rows={3} className="text-sm" />
          </div>
        </div>
      </ConfirmDialog>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  )
}
