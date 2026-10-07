import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { formatDate, useUiPreferences } from '@emdad/core'
import { ConfirmDialog, DataTable, PageHeader, useNavigate } from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { Card, CardContent } from '@emdad/ui/ui/card'
import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { ReturnsApi, type ReturnOrder, type ReturnOrderLine } from '@/api/returns'
import { QK } from '@/constants/query-keys'
import { invalidateWorkflowTasksInventory } from '@/lib/invalidate-wms-queries'
import { dispositionLabel } from '@/lib/return-labels'
import { isOperatorRole } from '@/lib/rbac'
import { useAuth } from '@/auth/AuthContext'
import { ReturnLineStatusBadge, ReturnOrderStatusBadge } from './wms-returns-ui'

export function ReturnDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const isOperator = isOperatorRole(user?.role)
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const [cancelOpen, setCancelOpen] = useState(false)

  const detail = useQuery({
    queryKey: QK.returns.detail(id),
    queryFn: () => ReturnsApi.get(id),
    enabled: !!id,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: QK.returns.detail(id) })
    qc.invalidateQueries({ queryKey: QK.returns.all })
  }

  const confirmMut = useMutation({
    mutationFn: () => ReturnsApi.confirm(id),
    onSuccess: () => {
      toast.success(t('Return confirmed.', 'تم تأكيد الإرجاع.'))
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const startReceivingMut = useMutation({
    mutationFn: () => ReturnsApi.startReceiving(id),
    onSuccess: () => {
      toast.success(t('Receiving started.', 'بدأ الاستلام.'))
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const postMut = useMutation({
    mutationFn: () => ReturnsApi.postInventory(id),
    onSuccess: () => {
      toast.success(t('Inventory posted.', 'تم ترحيل المخزون.'))
      invalidate()
      invalidateWorkflowTasksInventory(qc)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const completeMut = useMutation({
    mutationFn: () => ReturnsApi.complete(id),
    onSuccess: () => {
      toast.success(t('Return completed.', 'اكتمل الإرجاع.'))
      invalidate()
      navigate('/returns')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const cancelMut = useMutation({
    mutationFn: () => ReturnsApi.cancel(id),
    onSuccess: () => {
      toast.success(t('Return cancelled.', 'أُلغي الإرجاع.'))
      setCancelOpen(false)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const order = detail.data
  const busy =
    confirmMut.isPending ||
    startReceivingMut.isPending ||
    postMut.isPending ||
    completeMut.isPending ||
    cancelMut.isPending

  const canProcess =
    order &&
    (order.status === 'confirmed' || order.status === 'receiving' || order.status === 'inspecting')

  const lineCols = useMemo<ColumnDef<ReturnOrderLine>[]>(
    () => [
      {
        id: 'sku',
        header: 'SKU',
        cell: ({ row }) => <span className="font-mono text-sm">{row.original.product.sku}</span>,
      },
      { id: 'name', header: t('Product', 'المنتج'), cell: ({ row }) => row.original.product.name },
      {
        id: 'expected',
        header: t('Expected', 'المتوقع'),
        cell: ({ row }) => (
          <span className="font-mono text-sm">{Number(row.original.expectedQuantity).toLocaleString()}</span>
        ),
      },
      {
        id: 'received',
        header: t('Received', 'مستلم'),
        cell: ({ row }) => (
          <span className="font-mono text-sm">{Number(row.original.receivedQuantity).toLocaleString()}</span>
        ),
      },
      {
        id: 'posted',
        header: t('Posted', 'مرحّل'),
        cell: ({ row }) => (
          <span className="font-mono text-sm">{Number(row.original.postedQuantity).toLocaleString()}</span>
        ),
      },
      {
        id: 'lineStatus',
        header: t('Line', 'البند'),
        cell: ({ row }) => <ReturnLineStatusBadge status={row.original.lineStatus} isArabic={isArabic} />,
      },
      {
        id: 'disposition',
        header: t('Disposition', 'التصرف'),
        cell: ({ row }) => (
          <span className="text-sm">{dispositionLabel(row.original.disposition, isArabic)}</span>
        ),
      },
      {
        id: 'location',
        header: t('Location', 'الموقع'),
        cell: ({ row }) => (
          <span className="font-mono text-sm" title={row.original.targetLocation?.fullPath}>
            {row.original.targetLocation?.fullPath ?? '—'}
          </span>
        ),
      },
    ],
    [isArabic],
  )

  if (detail.isLoading) {
    return <p className="text-sm text-muted-foreground">{t('Loading…', 'جاري التحميل…')}</p>
  }

  if (!order) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t('Return not found.', 'الإرجاع غير موجود.')}</AlertTitle>
      </Alert>
    )
  }

  return (
    <div className="space-y-5 pb-8">
      <Button variant="ghost" size="sm" className="ps-0" asChild>
        <Link to="/returns">
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
          {t('Back to returns', 'العودة إلى الإرجاعات')}
        </Link>
      </Button>

      <PageHeader
        title={order.orderNumber}
        description={order.company.name}
        actions={
          <div className="flex flex-wrap gap-2">
            {canProcess ? (
              <Button asChild>
                <Link to={`/returns/${id}/process`}>{t('Process', 'معالجة')}</Link>
              </Button>
            ) : null}
            {order.status === 'draft' && !isOperator ? (
              <Button disabled={busy} onClick={() => confirmMut.mutate()}>
                {t('Confirm', 'تأكيد')}
              </Button>
            ) : null}
            {order.status === 'confirmed' ? (
              <Button variant="secondary" disabled={busy} onClick={() => startReceivingMut.mutate()}>
                {t('Start receiving', 'بدء الاستلام')}
              </Button>
            ) : null}
            {!isOperator && (order.status === 'receiving' || order.status === 'inspecting') ? (
              <>
                <Button variant="secondary" disabled={busy} onClick={() => postMut.mutate()}>
                  {t('Post inventory', 'ترحيل المخزون')}
                </Button>
                <Button disabled={busy} onClick={() => completeMut.mutate()}>
                  {t('Complete', 'إكمال')}
                </Button>
              </>
            ) : null}
            {order.status === 'draft' ? (
              <Button variant="ghost" disabled={busy} onClick={() => setCancelOpen(true)}>
                {t('Cancel', 'إلغاء')}
              </Button>
            ) : null}
          </div>
        }
      />

      <ReturnSummary order={order} isArabic={isArabic} locale={locale} />

      <h2 className="text-sm font-semibold">{t('Lines', 'البنود')}</h2>
      <DataTable<ReturnOrderLine>
        columns={lineCols}
        data={order.lines}
        getRowId={(l) => l.id}
      />

      <ConfirmDialog
        open={cancelOpen}
        title={t('Cancel return?', 'إلغاء الإرجاع؟')}
        description={t(
          'Only draft returns with no received quantity can be cancelled.',
          'مسودات دون كميات مستلمة فقط.',
        )}
        confirmLabel={t('Cancel return', 'إلغاء الإرجاع')}
        cancelLabel={t('Keep', 'الاحتفاظ')}
        intent="danger"
        loading={cancelMut.isPending}
        onOpenChange={(o) => !o && !cancelMut.isPending && setCancelOpen(false)}
        onConfirm={() => cancelMut.mutate()}
      />
    </div>
  )
}

function ReturnSummary({ order, isArabic, locale }: { order: ReturnOrder; isArabic: boolean; locale: string }) {
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  return (
    <Card>
      <CardContent className="grid gap-3 pt-6 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-muted-foreground">{t('Client', 'العميل')}</p>
          <p className="font-medium">{order.company.name}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{t('Warehouse', 'المستودع')}</p>
          <p className="font-medium">{order.warehouse?.code ?? '—'}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{t('Outbound', 'الصادر')}</p>
          {order.originalOutbound ? (
            <Link to={`/orders/outbound/${order.originalOutbound.id}`} className="font-mono text-primary hover:underline">
              {order.originalOutbound.orderNumber}
            </Link>
          ) : (
            '—'
          )}
        </div>
        <div>
          <p className="text-muted-foreground">{t('Status', 'الحالة')}</p>
          <ReturnOrderStatusBadge status={order.status} isArabic={isArabic} />
        </div>
        {order.notes ? (
          <div className="sm:col-span-2 lg:col-span-4">
            <p className="text-muted-foreground">{t('Notes', 'ملاحظات')}</p>
            <p className="whitespace-pre-wrap">{order.notes}</p>
          </div>
        ) : null}
        <div>
          <p className="text-muted-foreground">{t('Created', 'أُنشئ')}</p>
          <p>{formatDate(order.createdAt, locale)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{t('Completed', 'اكتمل')}</p>
          <p>{order.completedAt ? formatDate(order.completedAt, locale) : '—'}</p>
        </div>
      </CardContent>
    </Card>
  )
}
