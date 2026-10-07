import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Loader2, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { formatDateTime, useUiPreferences } from '@emdad/core'
import { ConfirmDialog, DataTable, PageHeader, ResetFiltersButton, useNavigate as useAppNavigate } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { Combobox } from '@emdad/ui/ui/combobox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@emdad/ui/ui/dropdown-menu'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { toast } from 'sonner'
import { AdjustmentsApi, type StockAdjustment } from '@/api/adjustments'
import { CompaniesApi } from '@/api/companies'
import { ProductsApi } from '@/api/products'
import { QK } from '@/constants/query-keys'
import { useDefaultWarehouseId } from '@/hooks/useDefaultWarehouse'
import { useFilters } from '@/hooks/useFilters'
import { companyFilterComboboxOptions } from '@/lib/company-filter-options'
import { InventorySubNav } from './InventorySubNav'
import { NewAdjustmentDialog } from './NewAdjustmentDialog'
import { AdjustmentStatusBadge } from './inventory-shared'

type AdjListDraft = {
  adjustmentId: string
  productId: string
  clientId: string
  lotId: string
  createdFrom: string
  createdTo: string
}

export function AdjustmentsListPage() {
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useAppNavigate()
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const deepLinkAdjustmentId = searchParams.get('adjustmentId')?.trim() || ''
  const [newModalOpen, setNewModalOpen] = useState(false)
  const [draftDeleteTarget, setDraftDeleteTarget] = useState<StockAdjustment | null>(null)

  const { warehouseId } = useDefaultWarehouseId()

  useEffect(() => {
    if (!deepLinkAdjustmentId) return
    const next = new URLSearchParams(searchParams)
    next.delete('adjustmentId')
    setSearchParams(next, { replace: true })
    navigate(`/inventory/adjustments/${deepLinkAdjustmentId}`)
  }, [deepLinkAdjustmentId, navigate, searchParams, setSearchParams])

  const initialAdj = useMemo<AdjListDraft>(
    () => ({
      adjustmentId: '',
      productId: '',
      clientId: '',
      lotId: '',
      createdFrom: '',
      createdTo: '',
    }),
    [],
  )

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } = useFilters(initialAdj)

  const listParams = useMemo(
    () => ({
      warehouseId: warehouseId || undefined,
      companyId: appliedFilters.clientId || undefined,
      adjustmentId: appliedFilters.adjustmentId.trim() || undefined,
      productId: appliedFilters.productId || undefined,
      lotId: appliedFilters.lotId.trim() || undefined,
      createdFrom: appliedFilters.createdFrom.trim() || undefined,
      createdTo: appliedFilters.createdTo.trim() || undefined,
      limit: 100,
    }),
    [appliedFilters, warehouseId],
  )

  const list = useQuery({
    queryKey: [...QK.adjustments, listParams],
    queryFn: () => AdjustmentsApi.list(listParams),
    enabled: !!warehouseId,
  })

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    staleTime: 10 * 60_000,
  })

  const clientListFilterOptions = useMemo(
    () => companyFilterComboboxOptions(companies.data, t('All clients', 'كل العملاء')),
    [companies.data, isArabic], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const productDraftOptions = useQuery({
    queryKey: [...QK.products, 'adjustments-draft-products', draftFilters.clientId || '__all__'],
    queryFn: () =>
      ProductsApi.list({
        companyId: draftFilters.clientId || undefined,
        limit: 300,
      }),
    enabled: !!warehouseId,
    staleTime: 5 * 60_000,
  })

  const discardDraftMut = useMutation({
    mutationFn: AdjustmentsApi.cancel,
    onSuccess: () => {
      toast.success(t('Draft deleted.', 'تم حذف المسودة.'))
      qc.invalidateQueries({ queryKey: QK.adjustments })
      setDraftDeleteTarget(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const columns = useMemo<ColumnDef<StockAdjustment>[]>(
    () => [
      {
        id: 'client',
        header: t('Client name', 'اسم العميل'),
        cell: ({ row }) => row.original.company?.name ?? '—',
        meta: { priority: 1, className: 'min-w-32' },
      },
      {
        id: 'status',
        header: t('Status', 'الحالة'),
        cell: ({ row }) => <AdjustmentStatusBadge status={row.original.status} isArabic={isArabic} />,
        meta: { priority: 1, className: 'min-w-28' },
      },
      {
        id: 'id',
        header: t('Adjustment id', 'معرف التعديل'),
        cell: ({ row }) => (
          <Link
            to={`/inventory/adjustments/${row.original.id}`}
            className="font-mono text-xs text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.id.slice(0, 16)}…
          </Link>
        ),
        meta: { priority: 1, className: 'min-w-48' },
      },
      {
        id: 'lines',
        header: t('Lines', 'البنود'),
        cell: ({ row }) => row.original.lines?.length ?? 0,
        meta: { priority: 2, align: 'end', className: 'min-w-16' },
      },
      {
        id: 'date',
        header: t('Date', 'التاريخ'),
        cell: ({ row }) => formatDateTime(row.original.createdAt, locale),
        meta: { priority: 2, className: 'min-w-36' },
      },
      {
        id: 'actions',
        header: t('Actions', 'الإجراءات'),
        cell: ({ row }) => {
          const a = row.original
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={t('Actions', 'الإجراءات')} onClick={(e) => e.stopPropagation()}>
                  <MoreHorizontal aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/inventory/adjustments/${a.id}`)}>
                  {a.status === 'draft' ? t('Edit', 'تعديل') : t('Open', 'فتح')}
                </DropdownMenuItem>
                {a.status === 'draft' ? (
                  <DropdownMenuItem className="text-destructive" onClick={() => setDraftDeleteTarget(a)}>
                    <Trash2 className="me-2 size-4" aria-hidden />
                    {t('Delete', 'حذف')}
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
        meta: { priority: 1, align: 'end', cardAction: true, className: 'min-w-16' },
      },
    ],
    [isArabic, locale, navigate], // eslint-disable-line react-hooks/exhaustive-deps
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('Stock adjustments', 'تعديلات المخزون')}
        description={t('Draft, approve, and audit quantity corrections.', 'مسودات واعتماد وتدقيق تعديلات الكميات.')}
        actions={
          <Button type="button" disabled={!warehouseId} onClick={() => setNewModalOpen(true)}>
            <Plus aria-hidden />
            {t('New adjustment', 'تعديل جديد')}
          </Button>
        }
      />
      <InventorySubNav />

      <section aria-label={t('Filters', 'التصفية')} className="space-y-3 rounded-xl border bg-card p-3">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            applyFilters()
          }}
        >
          <div className="min-w-48 space-y-1.5">
            <Label htmlFor="adj-id-filter">{t('Adjustment id', 'معرف التعديل')}</Label>
            <Input
              id="adj-id-filter"
              className="font-mono text-xs"
              value={draftFilters.adjustmentId}
              onChange={(e) => setDraft({ adjustmentId: e.target.value })}
            />
          </div>
          <div className="min-w-48 space-y-1.5">
            <Label>{t('Client', 'العميل')}</Label>
            <Combobox
              value={draftFilters.clientId}
              onChange={(v) => setDraft({ clientId: v })}
              options={clientListFilterOptions}
              placeholder={t('All clients', 'كل العملاء')}
            />
          </div>
          <div className="min-w-56 space-y-1.5">
            <Label>{t('Product', 'المنتج')}</Label>
            <Combobox
              value={draftFilters.productId}
              onChange={(v) => setDraft({ productId: v })}
              options={(productDraftOptions.data?.items ?? []).map((p) => ({
                value: p.id,
                label: `${p.sku} — ${p.name}`,
              }))}
              placeholder={t('All products', 'كل المنتجات')}
            />
          </div>
          <div className="min-w-40 space-y-1.5">
            <Label htmlFor="adj-lot">{t('Lot id', 'معرف الدفعة')}</Label>
            <Input
              id="adj-lot"
              className="font-mono text-xs"
              value={draftFilters.lotId}
              onChange={(e) => setDraft({ lotId: e.target.value })}
            />
          </div>
          <div className="min-w-36 space-y-1.5">
            <Label htmlFor="adj-from">{t('Created from', 'من')}</Label>
            <Input
              id="adj-from"
              type="date"
              value={draftFilters.createdFrom}
              onChange={(e) => setDraft({ createdFrom: e.target.value })}
            />
          </div>
          <div className="min-w-36 space-y-1.5">
            <Label htmlFor="adj-to">{t('Created to', 'إلى')}</Label>
            <Input
              id="adj-to"
              type="date"
              value={draftFilters.createdTo}
              onChange={(e) => setDraft({ createdTo: e.target.value })}
            />
          </div>
          <div className="ms-auto flex items-center gap-2 pb-0.5">
            <ResetFiltersButton label={t('Reset', 'إعادة تعيين')} onClick={resetFilters} />
            <Button type="submit" disabled={list.isFetching || !warehouseId}>
              {list.isFetching ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {t('Apply', 'تطبيق')}
            </Button>
          </div>
        </form>
      </section>

      <DataTable<StockAdjustment>
        columns={columns}
        data={list.data?.items ?? []}
        getRowId={(a) => a.id}
        loading={list.isLoading || !warehouseId}
        empty={warehouseId ? t('No adjustments match the filters.', 'لا توجد تعديلات مطابقة.') : t('Warehouse not resolved.', 'لم يُحدد المستودع.')}
        onRowClick={(a) => navigate(`/inventory/adjustments/${a.id}`)}
        labels={{
          rowsPerPage: t('Rows per page', 'عدد الصفوف في الصفحة'),
          of: t('of', 'من'),
          noResults: t('No results', 'لا نتائج'),
        }}
      />

      <NewAdjustmentDialog open={newModalOpen} warehouseId={warehouseId ?? ''} onClose={() => setNewModalOpen(false)} />

      <ConfirmDialog
        open={!!draftDeleteTarget}
        title={t('Delete this draft?', 'حذف هذه المسودة؟')}
        description={t(
          'This removes the draft and its lines. This cannot be undone.',
          'سيؤدي هذا إلى حذف المسودة وبنودها. لا يمكن التراجع.',
        )}
        confirmLabel={t('Delete', 'حذف')}
        cancelLabel={t('Cancel', 'إلغاء')}
        intent="danger"
        loading={discardDraftMut.isPending}
        onOpenChange={(open) => !open && !discardDraftMut.isPending && setDraftDeleteTarget(null)}
        onConfirm={() => {
          if (draftDeleteTarget) discardDraftMut.mutate(draftDeleteTarget.id)
        }}
      />
    </div>
  )
}
