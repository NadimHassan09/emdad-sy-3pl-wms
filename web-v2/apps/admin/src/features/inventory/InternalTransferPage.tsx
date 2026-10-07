import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { formatDateTime, useUiPreferences } from '@emdad/core'
import { DataTable, EmptyState, PageHeader } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { Plus } from 'lucide-react'
import { InventoryApi, type LedgerRow } from '@/api/inventory'
import type { Location } from '@/api/locations'
import { useAuth } from '@/auth/AuthContext'
import { QK } from '@/constants/query-keys'
import { useDefaultWarehouseId } from '@/hooks/useDefaultWarehouse'
import { useResolvedLocations } from '@/hooks/useResolvedLocations'
import { fmtLedgerQty } from '@/lib/ledger-display'
import { canAccessInternalTransfer } from '@/lib/rbac'
import { CreateInternalTransferDialog } from './CreateInternalTransferDialog'

function formatTransferLocationLabel(loc: Location | undefined, id: string | null | undefined): string {
  if (!id) return '—'
  if (!loc) return `${id.slice(0, 8)}…`
  const primary = loc.fullPath?.trim() || loc.name?.trim() || loc.barcode?.trim()
  if (primary) return primary
  return `${id.slice(0, 8)}…`
}

export function InternalTransferPage() {
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const { user } = useAuth()
  const { warehouseId } = useDefaultWarehouseId()
  const [createOpen, setCreateOpen] = useState(false)
  const allowed = canAccessInternalTransfer(user?.role)

  const transfers = useQuery({
    queryKey: [...QK.ledger, 'internal-transfers', warehouseId],
    queryFn: () =>
      InventoryApi.ledger({
        warehouseId: warehouseId || undefined,
        movementType: 'internal_transfer',
        referenceType: 'transfer',
        limit: 300,
      }),
    enabled: !!warehouseId && allowed,
  })

  const historyLocationIds = useMemo(() => {
    const ids: string[] = []
    for (const r of transfers.data?.items ?? []) {
      if (r.fromLocationId) ids.push(r.fromLocationId)
      if (r.toLocationId) ids.push(r.toLocationId)
    }
    return ids
  }, [transfers.data?.items])

  const { locationById } = useResolvedLocations(historyLocationIds)

  const columns = useMemo<ColumnDef<LedgerRow>[]>(
    () => [
      {
        id: 'when',
        header: t('When', 'متى'),
        cell: ({ row }) => formatDateTime(row.original.createdAt, locale),
      },
      {
        id: 'client',
        header: t('Client', 'العميل'),
        cell: ({ row }) => row.original.company.name,
      },
      {
        id: 'product',
        header: t('Product', 'المنتج'),
        cell: ({ row }) => (
          <div>
            <div className="text-sm font-medium">{row.original.product.name}</div>
            <div className="font-mono text-xs text-muted-foreground">{row.original.product.sku}</div>
          </div>
        ),
      },
      {
        id: 'lot',
        header: t('Lot', 'الدفعة'),
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.lot?.lotNumber ?? '—'}</span>
        ),
      },
      {
        id: 'qty',
        header: t('Qty', 'الكمية'),
        cell: ({ row }) => (
          <span className="font-mono text-sm">{fmtLedgerQty(row.original.quantity)}</span>
        ),
      },
      {
        id: 'fromTo',
        header: t('From → To', 'من → إلى'),
        cell: ({ row }) => {
          const fromLoc = row.original.fromLocationId
            ? locationById.get(row.original.fromLocationId)
            : undefined
          const toLoc = row.original.toLocationId ? locationById.get(row.original.toLocationId) : undefined
          const fromLabel = formatTransferLocationLabel(fromLoc, row.original.fromLocationId)
          const toLabel = formatTransferLocationLabel(toLoc, row.original.toLocationId)
          return (
            <div className="text-xs">
              <div className="font-medium" title={fromLoc?.fullPath ?? row.original.fromLocationId ?? undefined}>
                {fromLabel}
              </div>
              <div className="text-muted-foreground">→</div>
              <div className="font-medium" title={toLoc?.fullPath ?? row.original.toLocationId ?? undefined}>
                {toLabel}
              </div>
            </div>
          )
        },
      },
      {
        id: 'ref',
        header: t('Ref', 'مرجع'),
        cell: ({ row }) => (
          <Link
            to={`/inventory/ledger/transfer/${row.original.referenceId}`}
            className="text-sm text-primary hover:underline"
          >
            {row.original.referenceId.slice(0, 8)}…
          </Link>
        ),
      },
    ],
    [isArabic, locale, locationById], // eslint-disable-line react-hooks/exhaustive-deps
  )

  if (!allowed) {
    return <Navigate to="/inventory/stock" replace />
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('Internal transfer', 'نقل داخلي')}
        actions={
          warehouseId ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" aria-hidden />
              {t('Create internal transfer', 'إنشاء نقل داخلي')}
            </Button>
          ) : null
        }
      />

      {!warehouseId ? (
        <p className="text-sm text-muted-foreground">
          {t('Resolve warehouse configuration first.', 'قم بحل إعدادات المستودع أولاً.')}
        </p>
      ) : (
        <DataTable
          columns={columns}
          data={transfers.data?.items ?? []}
          getRowId={(r) => `${r.id}:${r.createdAt}`}
          loading={transfers.isLoading}
          empty={
            <EmptyState title={t('No internal transfers yet.', 'لا توجد عمليات نقل داخلية بعد.')} />
          }
        />
      )}

      {warehouseId ? (
        <CreateInternalTransferDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          warehouseId={warehouseId}
        />
      ) : null}
    </div>
  )
}
