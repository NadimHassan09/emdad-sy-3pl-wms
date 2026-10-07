import { useMemo, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, SlidersHorizontal } from 'lucide-react'
import { formatDateTime, useUiPreferences } from '@emdad/core'
import { DataTable, ErrorState } from '@emdad/ui'
import { Card, CardContent, CardHeader, CardTitle } from '@emdad/ui/ui/card'
import { Skeleton } from '@emdad/ui/ui/skeleton'
import { AdjustmentsApi } from '@/api/adjustments'
import { InboundApi } from '@/api/inbound'
import { InventoryApi } from '@/api/inventory'
import { OutboundApi } from '@/api/outbound'
import { QK } from '@/constants/query-keys'
import { useDefaultWarehouseId } from '@/hooks/useDefaultWarehouse'
import {
  fmtSignedDelta,
  ledgerMovementCategory,
  ledgerMovementLabel,
  ledgerReferenceAdminPath,
  mergeLedgerLinesByLotAndLocation,
  type LedgerMovementCategory,
  type MergedLotLocationLine,
} from '@/lib/ledger-display'

function movementTone(cat: LedgerMovementCategory): string {
  switch (cat) {
    case 'inbound':
    case 'return':
      return 'text-emerald-600'
    case 'outbound':
      return 'text-red-600'
    default:
      return 'text-foreground'
  }
}

function MovementIcon({ cat }: { cat: LedgerMovementCategory }) {
  if (cat === 'inbound' || cat === 'return') return <ArrowDown className="size-5 text-muted-foreground" aria-hidden />
  if (cat === 'outbound') return <ArrowUp className="size-5 text-muted-foreground" aria-hidden />
  return <SlidersHorizontal className="size-5 text-muted-foreground" aria-hidden />
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  )
}

function ledgerReferenceIdLabel(referenceType: string, t: (en: string, ar: string) => string): string {
  switch (referenceType) {
    case 'inbound_order':
    case 'outbound_order':
      return t('Order #', 'رقم الطلب')
    case 'adjustment':
      return t('Adjustment ID', 'معرف التعديل')
    default:
      return t('Reference ID', 'معرف المرجع')
  }
}

export function InventoryLedgerEntryPage() {
  const { ledgerId: ledgerIdParam = '', createdAt: createdAtParam = '' } = useParams<{
    ledgerId: string
    createdAt: string
  }>()
  const [searchParams] = useSearchParams()
  const companyIdOverride = searchParams.get('companyId')?.trim() || undefined
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const { warehouseId } = useDefaultWarehouseId()

  const ledgerId = useMemo(() => {
    try {
      return decodeURIComponent(ledgerIdParam)
    } catch {
      return ledgerIdParam
    }
  }, [ledgerIdParam])

  const createdAt = useMemo(() => {
    try {
      return decodeURIComponent(createdAtParam)
    } catch {
      return createdAtParam
    }
  }, [createdAtParam])

  const query = useQuery({
    queryKey: warehouseId
      ? [...QK.ledgerEntry(warehouseId, ledgerId, createdAt), companyIdOverride ?? 'default-company']
      : ['inventory', 'ledger', 'entry', 'pending'],
    queryFn: () =>
      InventoryApi.ledgerEntry({
        ledgerId,
        createdAt,
        warehouseId: warehouseId || undefined,
        companyIdOverride,
      }),
    enabled: !!warehouseId && !!ledgerId && !!createdAt,
  })

  const headLine = query.data?.lines?.[0]

  const referenceMeta = useQuery({
    queryKey: ['ledger-reference-meta', headLine?.referenceType, headLine?.referenceId, companyIdOverride],
    queryFn: async () => {
      if (!headLine?.referenceId) return { label: '—', to: null as string | null }
      const { referenceType, referenceId } = headLine
      const to = ledgerReferenceAdminPath(referenceType, referenceId)
      switch (referenceType) {
        case 'inbound_order': {
          const order = await InboundApi.get(referenceId)
          return { label: order.orderNumber || referenceId, to }
        }
        case 'outbound_order': {
          const order = await OutboundApi.get(referenceId)
          return { label: order.orderNumber || referenceId, to }
        }
        case 'adjustment': {
          const adj = await AdjustmentsApi.get(referenceId)
          return { label: adj.id, to }
        }
        default:
          return { label: referenceId, to }
      }
    },
    enabled: !!headLine?.referenceId,
    staleTime: 60_000,
  })

  const mergedRows = useMemo(() => mergeLedgerLinesByLotAndLocation(query.data?.lines ?? []), [query.data?.lines])

  const columns = useMemo<ColumnDef<MergedLotLocationLine>[]>(
    () => [
      {
        id: 'lot',
        header: t('Lot', 'الدفعة'),
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.lotNumber}</span>,
        meta: { priority: 1, className: 'min-w-28' },
      },
      {
        id: 'location',
        header: t('Location', 'الموقع'),
        cell: ({ row }) => <span className="text-sm">{row.original.locationDescription}</span>,
        meta: { priority: 1, className: 'min-w-48' },
      },
      {
        id: 'qty',
        header: t('Quantity', 'الكمية'),
        cell: ({ row }) => {
          const { delta } = row.original
          return (
            <span
              className={`font-mono font-semibold tabular-nums ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-600' : ''}`}
            >
              {fmtSignedDelta(delta)}
            </span>
          )
        },
        meta: { priority: 1, align: 'end', className: 'min-w-24' },
      },
    ],
    [isArabic], // eslint-disable-line react-hooks/exhaustive-deps
  )

  if (!ledgerId || !createdAt) return null

  const category = headLine ? ledgerMovementCategory(headLine.movementType) : null
  const refTo =
    referenceMeta.data?.to ?? (headLine ? ledgerReferenceAdminPath(headLine.referenceType, headLine.referenceId) : null)

  return (
    <div className="space-y-4">
      <Link to="/inventory/ledger" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
        ← {t('Back to ledger', 'العودة إلى السجل')}
      </Link>

      {!warehouseId ? (
        <p className="text-sm text-muted-foreground">{t('Resolve warehouse configuration…', 'يلزم تهيئة المستودع…')}</p>
      ) : null}

      {query.isError ? (
        <ErrorState title={t('Could not load this movement.', 'تعذر تحميل هذه الحركة.')} />
      ) : null}

      {query.isLoading ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : headLine ? (
        <Card>
          <CardHeader className="flex flex-row items-start gap-4 space-y-0">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-muted">
              {category ? <MovementIcon cat={category} /> : null}
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle>{t('Movement information', 'معلومات الحركة')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField
                label={t('Movement type', 'نوع الحركة')}
                value={
                  category ? (
                    <span className={movementTone(category)}>{ledgerMovementLabel(category, isArabic)}</span>
                  ) : (
                    '—'
                  )
                }
              />
              <DetailField
                label={t('Product SKU', 'رمز الصنف')}
                value={<span className="font-mono">{headLine.product.sku}</span>}
              />
              <DetailField
                label={ledgerReferenceIdLabel(headLine.referenceType, t)}
                value={
                  refTo ? (
                    <Link to={refTo} className="font-mono text-xs text-primary hover:underline">
                      {referenceMeta.data?.label ?? headLine.referenceId}
                    </Link>
                  ) : (
                    <span className="font-mono text-xs">{referenceMeta.data?.label ?? headLine.referenceId}</span>
                  )
                }
              />
              <DetailField label={t('Product', 'المنتج')} value={headLine.product.name} />
              <DetailField label={t('Client', 'العميل')} value={headLine.company.name} />
              <DetailField
                label={t('When', 'الوقت')}
                value={formatDateTime(headLine.createdAt, locale)}
              />
              <DetailField label={t('Operator', 'المشغّل')} value={headLine.operator.fullName} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <DataTable<MergedLotLocationLine>
        columns={columns}
        data={mergedRows}
        getRowId={(r) => r.key}
        loading={query.isLoading || !warehouseId}
        empty={
          warehouseId
            ? t('No lot/location lines for this movement.', 'لا توجد بنود دفعة/موقع.')
            : t('Warehouse not resolved yet.', 'لم يُحدد المستودع بعد.')
        }
        labels={{ noResults: t('No results', 'لا نتائج') }}
      />
    </div>
  )
}
