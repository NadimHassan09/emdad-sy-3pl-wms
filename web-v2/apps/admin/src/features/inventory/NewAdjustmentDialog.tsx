import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Loader2, Trash2 } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import { DataTable } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { Combobox } from '@emdad/ui/ui/combobox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@emdad/ui/ui/dialog'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { toast } from 'sonner'
import { AdjustmentsApi, type AddAdjustmentLineInput } from '@/api/adjustments'
import { CompaniesApi } from '@/api/companies'
import { QK } from '@/constants/query-keys'
import { AddAdjustmentLineForm } from './AddAdjustmentLineForm'
import { fmtQty } from './inventory-shared'

type PendingAdjustmentRow = {
  key: string
  body: AddAdjustmentLineInput
  sku: string
  productName: string
  locationPath: string
  lotLabel?: string
  quantityBefore: string
}

export function NewAdjustmentDialog({
  open,
  warehouseId,
  onClose,
}: {
  open: boolean
  warehouseId: string
  onClose: () => void
}) {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const qc = useQueryClient()

  const [step, setStep] = useState<1 | 2>(1)
  const [newCompanyId, setNewCompanyId] = useState('')
  const [newReason, setNewReason] = useState('')
  const [pendingRows, setPendingRows] = useState<PendingAdjustmentRow[]>([])

  useEffect(() => {
    if (!open) {
      setStep(1)
      setNewCompanyId('')
      setNewReason('')
      setPendingRows([])
    }
  }, [open])

  useEffect(() => {
    setPendingRows([])
  }, [newCompanyId])

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    enabled: open,
    staleTime: 10 * 60_000,
  })

  const companyOptions = useMemo(
    () => (companies.data ?? []).map((c) => ({ value: c.id, label: c.name })),
    [companies.data],
  )

  const composeSaveMut = useMutation({
    mutationFn: async () => {
      const companyId = newCompanyId.trim()
      const reason = newReason.trim()
      if (!warehouseId || !companyId || !reason) {
        throw new Error(t('Select client and enter a reason.', 'اختر العميل وأدخل السبب.'))
      }
      if (pendingRows.length === 0) {
        throw new Error(t('Add at least one product line before saving.', 'أضف بنداً واحداً على الأقل.'))
      }
      const created = await AdjustmentsApi.create({ warehouseId, companyId, reason })
      let last = created
      for (const row of pendingRows) {
        last = await AdjustmentsApi.addLine(created.id, row.body)
      }
      return last
    },
    onSuccess: (last) => {
      toast.success(t('Draft saved.', 'تم حفظ المسودة.'))
      qc.invalidateQueries({ queryKey: QK.adjustments })
      qc.invalidateQueries({ queryKey: [...QK.adjustments, last.id] })
      qc.invalidateQueries({ queryKey: QK.inventoryStock })
      qc.invalidateQueries({ queryKey: QK.inventoryStockByProduct })
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const composeConfirmMut = useMutation({
    mutationFn: async () => {
      const companyId = newCompanyId.trim()
      const reason = newReason.trim()
      if (!warehouseId || !companyId || !reason) {
        throw new Error(t('Select client and enter a reason.', 'اختر العميل وأدخل السبب.'))
      }
      if (pendingRows.length === 0) {
        throw new Error(t('Add at least one line before confirming.', 'أضف بنداً واحداً على الأقل.'))
      }
      const created = await AdjustmentsApi.create({ warehouseId, companyId, reason })
      let last = created
      for (const row of pendingRows) {
        last = await AdjustmentsApi.addLine(created.id, row.body)
      }
      return AdjustmentsApi.approve(last.id)
    },
    onSuccess: () => {
      toast.success(t('Adjustment confirmed; stock updated.', 'تم تأكيد التعديل وتحديث المخزون.'))
      qc.invalidateQueries({ queryKey: QK.adjustments })
      qc.invalidateQueries({ queryKey: QK.inventoryStock })
      qc.invalidateQueries({ queryKey: QK.inventoryStockByProduct })
      qc.invalidateQueries({ queryKey: QK.ledger })
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const pending = composeSaveMut.isPending || composeConfirmMut.isPending
  const canGoNext = !!warehouseId && !!newCompanyId.trim() && !!newReason.trim()

  const pendingCols = useMemo<ColumnDef<PendingAdjustmentRow>[]>(
    () => [
      {
        id: 'sku',
        header: t('SKU', 'SKU'),
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.sku}</span>,
        meta: { priority: 1, className: 'min-w-24' },
      },
      {
        id: 'product',
        header: t('Product', 'المنتج'),
        cell: ({ row }) => row.original.productName,
        meta: { priority: 1, className: 'min-w-32' },
      },
      {
        id: 'location',
        header: t('Location', 'الموقع'),
        cell: ({ row }) => row.original.locationPath,
        meta: { priority: 2, className: 'min-w-40' },
      },
      {
        id: 'qty',
        header: t('Before → After', 'قبل → بعد'),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {fmtQty(row.original.quantityBefore)} → {fmtQty(row.original.body.quantityAfter)}
          </span>
        ),
        meta: { priority: 1, className: 'min-w-32' },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            aria-label={t('Remove', 'إزالة')}
            onClick={() => setPendingRows((rows) => rows.filter((x) => x.key !== row.original.key))}
          >
            <Trash2 aria-hidden />
          </Button>
        ),
        meta: { priority: 1, align: 'end', cardAction: true },
      },
    ],
    [pending, isArabic], // eslint-disable-line react-hooks/exhaustive-deps
  )

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !pending && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('New stock adjustment', 'تعديل مخزون جديد')}</DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t('Client', 'العميل')}</Label>
              <Combobox
                value={newCompanyId}
                onChange={setNewCompanyId}
                options={companyOptions}
                placeholder={t('Select client…', 'اختر العميل…')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adj-reason">{t('Reason', 'السبب')}</Label>
              <Input
                id="adj-reason"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder={t('Required before approve', 'مطلوب قبل الاعتماد')}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <AddAdjustmentLineForm
              scope={{ warehouseId, companyId: newCompanyId }}
              loading={pending}
              onAdd={({ body, display }) => {
                setPendingRows((rows) => [
                  ...rows,
                  {
                    key: `${body.productId}-${body.locationId}-${body.lotId ?? 'nolot'}-${Date.now()}`,
                    body,
                    sku: display.sku,
                    productName: display.productName,
                    locationPath: display.locationPath,
                    lotLabel: display.lotLabel,
                    quantityBefore: display.quantityBefore,
                  },
                ])
              }}
            />
            <DataTable<PendingAdjustmentRow>
              columns={pendingCols}
              data={pendingRows}
              getRowId={(r) => r.key}
              empty={t('No lines yet.', 'لا بنود بعد.')}
              labels={{ noResults: t('No results', 'لا نتائج') }}
            />
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 1 ? (
            <>
              <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
                {t('Cancel', 'إلغاء')}
              </Button>
              <Button type="button" disabled={!canGoNext || pending} onClick={() => setStep(2)}>
                {t('Next', 'التالي')}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={pending}>
                {t('Back', 'رجوع')}
              </Button>
              <Button type="button" variant="outline" disabled={pending || pendingRows.length === 0} onClick={() => composeSaveMut.mutate()}>
                {composeSaveMut.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {t('Save draft', 'حفظ مسودة')}
              </Button>
              <Button type="button" disabled={pending || pendingRows.length === 0} onClick={() => composeConfirmMut.mutate()}>
                {composeConfirmMut.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {t('Confirm', 'تأكيد')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
