import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import { ConfirmDialog, DataTable, ErrorState, useNavigate } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { toast } from 'sonner'
import {
  ADJUSTMENT_REASON_PENDING,
  AdjustmentsApi,
  type StockAdjustmentLine,
} from '@/api/adjustments'
import { QK } from '@/constants/query-keys'
import { useDefaultWarehouseId } from '@/hooks/useDefaultWarehouse'
import { AddAdjustmentLineForm } from './AddAdjustmentLineForm'
import { AdjustmentSummaryCard } from './AdjustmentSummaryCard'
import { fmtQty } from './inventory-shared'

export function AdjustmentDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { warehouseId } = useDefaultWarehouseId()
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)

  const detail = useQuery({
    queryKey: [...QK.adjustments, id],
    queryFn: () => AdjustmentsApi.get(id),
    enabled: !!id,
  })

  const adj = detail.data

  const addLineMut = useMutation({
    mutationFn: (body: Parameters<typeof AdjustmentsApi.addLine>[1]) => AdjustmentsApi.addLine(id, body),
    onSuccess: () => {
      toast.success(t('Line added.', 'تمت إضافة البند.'))
      qc.invalidateQueries({ queryKey: QK.adjustments })
      qc.invalidateQueries({ queryKey: [...QK.adjustments, id] })
      qc.invalidateQueries({ queryKey: QK.inventoryStock })
      qc.invalidateQueries({ queryKey: QK.inventoryStockByProduct })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const approveMut = useMutation({
    mutationFn: () => AdjustmentsApi.approve(id),
    onSuccess: () => {
      toast.success(t('Adjustment confirmed; stock updated.', 'تم تأكيد التعديل وتحديث المخزون.'))
      qc.invalidateQueries({ queryKey: QK.adjustments })
      qc.invalidateQueries({ queryKey: [...QK.adjustments, id] })
      qc.invalidateQueries({ queryKey: QK.inventoryStock })
      qc.invalidateQueries({ queryKey: QK.inventoryStockByProduct })
      qc.invalidateQueries({ queryKey: QK.ledger })
      navigate('/inventory/adjustments')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const cancelMut = useMutation({
    mutationFn: () => AdjustmentsApi.cancel(id),
    onSuccess: () => {
      toast.success(t('Draft deleted.', 'تم حذف المسودة.'))
      qc.invalidateQueries({ queryKey: QK.adjustments })
      qc.invalidateQueries({ queryKey: QK.inventoryStock })
      qc.invalidateQueries({ queryKey: QK.inventoryStockByProduct })
      qc.invalidateQueries({ queryKey: QK.ledger })
      setCancelConfirmOpen(false)
      navigate('/inventory/adjustments')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const lineCols = useMemo<ColumnDef<StockAdjustmentLine>[]>(
    () => [
      {
        id: 'product',
        header: t('Product name', 'اسم المنتج'),
        cell: ({ row }) => row.original.product.name,
        meta: { priority: 1, className: 'min-w-40' },
      },
      {
        id: 'sku',
        header: t('SKU', 'SKU'),
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.product.sku}</span>,
        meta: { priority: 1, className: 'min-w-28' },
      },
      {
        id: 'location',
        header: t('Location', 'الموقع'),
        cell: ({ row }) => row.original.location.fullPath,
        meta: { priority: 2, className: 'min-w-48' },
      },
      {
        id: 'before',
        header: t('Before', 'قبل'),
        cell: ({ row }) => <span className="font-mono text-xs">{fmtQty(row.original.quantityBefore)}</span>,
        meta: { priority: 1, align: 'end', className: 'min-w-24' },
      },
      {
        id: 'after',
        header: t('After', 'بعد'),
        cell: ({ row }) => <span className="font-mono text-xs">{fmtQty(row.original.quantityAfter)}</span>,
        meta: { priority: 1, align: 'end', className: 'min-w-24' },
      },
    ],
    [isArabic], // eslint-disable-line react-hooks/exhaustive-deps
  )

  if (!id) return null
  if (!warehouseId) {
    return <p className="text-sm text-muted-foreground">{t('Resolve warehouse configuration…', 'يلزم تهيئة المستودع…')}</p>
  }
  if (detail.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="animate-spin" aria-hidden />
        {t('Loading…', 'جاري التحميل…')}
      </div>
    )
  }
  if (detail.isError || !adj) {
    return <ErrorState title={t('Adjustment not found.', 'التعديل غير موجود.')} />
  }

  const isDraft = adj.status === 'draft'

  return (
    <div className="space-y-4">
      <Button type="button" variant="ghost" size="sm" className="-ms-2" asChild>
        <Link to="/inventory/adjustments">
          <ArrowLeft aria-hidden />
          {t('All adjustments', 'كل التعديلات')}
        </Link>
      </Button>

      {isDraft ? (
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setCancelConfirmOpen(true)}>
            {t('Delete draft', 'حذف المسودة')}
          </Button>
          <Button
            type="button"
            disabled={approveMut.isPending}
            onClick={() => {
              const r = adj.reason?.trim() ?? ''
              if (!r || r === ADJUSTMENT_REASON_PENDING) {
                toast.error(t('Enter an adjustment reason before confirming.', 'أدخل سبب التعديل قبل التأكيد.'))
                return
              }
              approveMut.mutate()
            }}
          >
            {approveMut.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {t('Confirm', 'تأكيد')}
          </Button>
        </div>
      ) : null}

      <AdjustmentSummaryCard adjustment={adj} t={t} locale={locale} isArabic={isArabic} />

      <DataTable<StockAdjustmentLine>
        columns={lineCols}
        data={adj.lines ?? []}
        getRowId={(l) => l.id}
        empty={t('No lines on this adjustment.', 'لا توجد بنود.')}
        labels={{ noResults: t('No results', 'لا نتائج') }}
      />

      {isDraft ? (
        <AddAdjustmentLineForm
          scope={{ warehouseId: adj.warehouseId, companyId: adj.companyId }}
          loading={addLineMut.isPending}
          onAdd={({ body }) => addLineMut.mutate(body)}
        />
      ) : null}

      <ConfirmDialog
        open={cancelConfirmOpen}
        title={t('Delete this draft?', 'حذف هذه المسودة؟')}
        description={t('This removes the draft and its lines.', 'سيؤدي هذا إلى حذف المسودة وبنودها.')}
        confirmLabel={t('Delete', 'حذف')}
        cancelLabel={t('Cancel', 'إلغاء')}
        intent="danger"
        loading={cancelMut.isPending}
        onOpenChange={(open) => !open && !cancelMut.isPending && setCancelConfirmOpen(false)}
        onConfirm={() => cancelMut.mutate()}
      />
    </div>
  )
}
