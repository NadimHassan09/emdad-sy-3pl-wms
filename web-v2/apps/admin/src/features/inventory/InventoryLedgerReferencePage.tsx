import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { formatDateTime, useUiPreferences } from '@emdad/core'
import { DataTable, PageHeader, useNavigate } from '@emdad/ui'
import { InventoryApi, type LedgerRow } from '@/api/inventory'
import { QK } from '@/constants/query-keys'
import { useDefaultWarehouseId } from '@/hooks/useDefaultWarehouse'
import { ledgerEntryDetailPath } from '@/lib/ledger-display'
import { MovementCategoryBadge, MovementQtyCell } from './inventory-shared'

function locationCell(row: LedgerRow): string {
  if (row.locationLabel) return row.locationLabel
  const parts: string[] = []
  if (row.fromLocationId) parts.push(`from ${row.fromLocationId.slice(0, 8)}…`)
  if (row.toLocationId) parts.push(`to ${row.toLocationId.slice(0, 8)}…`)
  if (row.locationId) parts.push(`${row.locationId.slice(0, 8)}…`)
  return parts.length ? parts.join(' · ') : '—'
}

export function InventoryLedgerReferencePage() {
  const { referenceType: refTypeParam = '', referenceId: refIdParam = '' } = useParams<{
    referenceType: string
    referenceId: string
  }>()
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const { warehouseId } = useDefaultWarehouseId()

  const referenceType = useMemo(() => {
    try {
      return decodeURIComponent(refTypeParam)
    } catch {
      return refTypeParam
    }
  }, [refTypeParam])

  const referenceId = useMemo(() => {
    try {
      return decodeURIComponent(refIdParam)
    } catch {
      return refIdParam
    }
  }, [refIdParam])

  const ledger = useQuery({
    queryKey: warehouseId
      ? QK.ledgerDetail(warehouseId, referenceType, referenceId)
      : ['inventory', 'ledger', 'detail', 'pending'],
    queryFn: () =>
      InventoryApi.ledger({
        warehouseId: warehouseId!,
        referenceType,
        referenceId,
        limit: 500,
      }),
    enabled: !!warehouseId && !!referenceType && !!referenceId,
  })

  const rows = useMemo(() => {
    const items = ledger.data?.items ?? []
    const narrowed = items.filter((r) => r.referenceType === referenceType && r.referenceId === referenceId)
    return narrowed.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }, [ledger.data?.items, referenceType, referenceId])

  const columns = useMemo<ColumnDef<LedgerRow>[]>(
    () => [
      {
        id: 'product',
        header: t('Product', 'المنتج'),
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.product.name}</div>
            <div className="font-mono text-xs text-muted-foreground">{row.original.product.sku}</div>
          </div>
        ),
        meta: { priority: 1, className: 'min-w-40' },
      },
      {
        id: 'client',
        header: t('Client', 'العميل'),
        cell: ({ row }) => row.original.company.name,
        meta: { priority: 2, className: 'min-w-32' },
      },
      {
        id: 'movement',
        header: t('Movement', 'الحركة'),
        cell: ({ row }) => <MovementCategoryBadge movementType={row.original.movementType} isArabic={isArabic} />,
        meta: { priority: 1, className: 'min-w-28' },
      },
      {
        id: 'location',
        header: t('Location', 'الموقع'),
        cell: ({ row }) => <span className="text-sm">{locationCell(row.original)}</span>,
        meta: { priority: 2, className: 'min-w-48' },
      },
      {
        id: 'lot',
        header: t('Lot', 'الدفعة'),
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.lot?.lotNumber ?? '—'}</span>
        ),
        meta: { priority: 3, className: 'min-w-24' },
      },
      {
        id: 'qty',
        header: t('Quantity', 'الكمية'),
        cell: ({ row }) => <MovementQtyCell row={row.original} />,
        meta: { priority: 1, align: 'end', className: 'min-w-24' },
      },
      {
        id: 'when',
        header: t('When', 'الوقت'),
        cell: ({ row }) => formatDateTime(row.original.createdAt, locale),
        meta: { priority: 2, className: 'min-w-36' },
      },
    ],
    [isArabic, locale], // eslint-disable-line react-hooks/exhaustive-deps
  )

  return (
    <div className="space-y-4">
      <Link to="/inventory/ledger" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
        ← {t('Back to ledger', 'العودة إلى السجل')}
      </Link>
      <PageHeader
        title={t('Ledger reference', 'مرجع السجل')}
        description={`${referenceType} · ${referenceId.slice(0, 12)}…`}
      />
      <DataTable<LedgerRow>
        columns={columns}
        data={rows}
        getRowId={(r) => `${r.id}:${r.createdAt}`}
        loading={ledger.isLoading || !warehouseId}
        empty={t('No lines for this reference.', 'لا توجد بنود لهذا المرجع.')}
        onRowClick={(r) => navigate(ledgerEntryDetailPath(r.id, r.createdAt, r.companyId))}
        labels={{
          noResults: t('No results', 'لا نتائج'),
        }}
      />
    </div>
  )
}
