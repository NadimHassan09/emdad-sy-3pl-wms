import type { StockRow } from '@/api/inventory'
import type { Location } from '@/api/locations'
import { isAdjustmentStockLocationType, locationTypeLabel } from '@/lib/location-types'

export type StockSourceLocationOption = { id: string; label: string; hint: string }

export function uniqueStockLocationIds(items: StockRow[]): string[] {
  return [...new Set(items.map((r) => r.locationId).filter(Boolean))]
}

/** Adjustment line locations from on-hand stock rows (uses embedded location paths). */
export function buildAdjustmentStockLocationOptions(stockItems: StockRow[]): StockSourceLocationOption[] {
  const byLoc = new Map<string, StockSourceLocationOption>()
  for (const row of stockItems) {
    const onHand = Number(row.quantityOnHand)
    if (!Number.isFinite(onHand) || onHand <= 0) continue
    if (!byLoc.has(row.locationId)) {
      byLoc.set(row.locationId, {
        id: row.locationId,
        label: row.location.fullPath || row.location.name,
        hint: row.location.barcode,
      })
    }
  }
  return [...byLoc.values()].sort((a, b) => a.label.localeCompare(b.label))
}

/** Source bins with on-hand stock for transfers (no full-warehouse list). */
export function buildStockSourceLocationOptions(params: {
  stockItems: StockRow[]
  locationById: Map<string, Location>
  productId: string
  lotId?: string
  lotTracked: boolean
  sourceTypeFilter?: string
  minQty?: (row: StockRow) => number
  typeLabel?: (type: string, isArabic?: boolean) => string
  isArabic?: boolean
  availWord?: string
}): StockSourceLocationOption[] {
  const {
    stockItems,
    locationById,
    productId,
    lotId,
    lotTracked,
    sourceTypeFilter,
    minQty = transferableQtyAtRow,
    typeLabel = locationTypeLabel,
    isArabic = false,
    availWord = 'avail',
  } = params

  if (!productId) return []

  const availByLoc = new Map<string, number>()

  for (const row of stockItems) {
    if (row.productId !== productId) continue
    const loc = locationById.get(row.locationId)
    if (!loc || !isAdjustmentStockLocationType(loc.type)) continue
    if (sourceTypeFilter && loc.type !== sourceTypeFilter) continue

    const rowLot = row.lotId ?? row.lot?.id ?? null
    if (lotTracked) {
      if (!lotId || rowLot !== lotId) continue
    } else if (rowLot) {
      continue
    }

    const qty = minQty(row)
    if (qty <= 0) continue
    availByLoc.set(loc.id, (availByLoc.get(loc.id) ?? 0) + qty)
  }

  return [...availByLoc.entries()]
    .map(([id, avail]) => {
      const loc = locationById.get(id)!
      return {
        id,
        label: loc.fullPath || loc.name,
        hint: `${typeLabel(loc.type, isArabic)} · ${availWord} ${avail.toLocaleString()}`,
      }
    })
    .sort((a, b) => a.label.localeCompare(b.label))
}

/** Matches backend decrement: on-hand minus reserved. */
export function transferableQtyAtRow(row: StockRow): number {
  const avail = Number(row.quantityAvailable)
  if (Number.isFinite(avail)) return Math.max(0, avail)
  const onHand = Number(row.quantityOnHand)
  const reserved = Number(row.quantityReserved)
  if (Number.isFinite(onHand) && Number.isFinite(reserved)) return Math.max(0, onHand - reserved)
  if (Number.isFinite(onHand)) return Math.max(0, onHand)
  return 0
}
