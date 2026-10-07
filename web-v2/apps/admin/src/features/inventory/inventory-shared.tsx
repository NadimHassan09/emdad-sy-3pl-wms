import type { ProductStockSummaryRow, StockRow } from '@/api/inventory'
import type { LedgerRow } from '@/api/inventory'
import type { ProductUom } from '@/api/products'
import { StatusBadge, type Tone } from '@emdad/ui'
import {
  fmtSignedDelta,
  ledgerMovementCategory,
  ledgerSignedChange,
} from '@/lib/ledger-display'

export function fmtQty(s: string | number): string {
  const n = Number(s)
  if (Number.isNaN(n)) return String(s)
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

const UOM_LABELS: Record<ProductUom, string> = {
  piece: 'Piece',
  kg: 'Kilogram',
  litre: 'Litre',
  carton: 'Carton',
  pallet: 'Pallet',
  box: 'Box',
  roll: 'Roll',
}

export function uomLabel(uom: string, isArabic: boolean): string {
  const en = UOM_LABELS[uom as ProductUom] ?? uom
  if (!isArabic) return en
  const ar: Record<string, string> = {
    piece: 'قطعة',
    kg: 'كيلوغرام',
    litre: 'لتر',
    carton: 'كرتون',
    pallet: 'منصة',
    box: 'صندوق',
    roll: 'لفة',
  }
  return ar[uom] ?? en
}

export function LastMovementCell({ row, isArabic }: { row: ProductStockSummaryRow; isArabic: boolean }) {
  const mv = row.lastMovement
  if (!mv) return <span className="text-muted-foreground">—</span>
  const n = Number(mv.quantityChange)
  const cat = ledgerMovementCategory(mv.movementType)
  const up = n > 0 || cat === 'inbound' || cat === 'return'
  const down = n < 0 || cat === 'outbound'
  const color = up && !down ? 'text-emerald-600' : down ? 'text-red-600' : 'text-muted-foreground'
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-sm font-semibold tabular-nums ${color}`}>
      {fmtSignedDelta(Number.isFinite(n) ? n : 0)}
    </span>
  )
}

export function MovementQtyCell({ row }: { row: LedgerRow }) {
  const n = ledgerSignedChange(row)
  const cat = ledgerMovementCategory(row.movementType)
  const color =
    cat === 'outbound' || n < 0
      ? 'text-red-600'
      : cat === 'inbound' || cat === 'return' || n > 0
        ? 'text-emerald-600'
        : 'text-foreground'
  return <span className={`font-mono font-semibold tabular-nums ${color}`}>{fmtSignedDelta(n)}</span>
}

const STOCK_STATUS_TONE: Record<StockRow['status'], Tone> = {
  available: 'success',
  quarantined: 'warning',
  awaiting_putaway: 'progress',
}

export function StockStatusBadge({ status, isArabic }: { status: StockRow['status']; isArabic: boolean }) {
  const labels: Record<StockRow['status'], { en: string; ar: string }> = {
    available: { en: 'Available', ar: 'متاح' },
    quarantined: { en: 'Quarantined', ar: 'حجر' },
    awaiting_putaway: { en: 'Awaiting putaway', ar: 'بانتظار التخزين' },
  }
  const cfg = labels[status] ?? labels.available
  return <StatusBadge tone={STOCK_STATUS_TONE[status] ?? 'neutral'}>{isArabic ? cfg.ar : cfg.en}</StatusBadge>
}

export function AdjustmentStatusBadge({ status, isArabic }: { status: 'draft' | 'approved' | 'cancelled'; isArabic: boolean }) {
  const tone: Record<typeof status, Tone> = {
    draft: 'pending',
    approved: 'success',
    cancelled: 'neutral',
  }
  const labels = {
    draft: { en: 'Draft', ar: 'مسودة' },
    approved: { en: 'Approved', ar: 'معتمد' },
    cancelled: { en: 'Cancelled', ar: 'ملغي' },
  }
  return <StatusBadge tone={tone[status]}>{isArabic ? labels[status].ar : labels[status].en}</StatusBadge>
}

export function MovementCategoryBadge({ movementType, isArabic }: { movementType: string; isArabic: boolean }) {
  const cat = ledgerMovementCategory(movementType)
  const tone: Record<string, Tone> = {
    inbound: 'success',
    return: 'success',
    outbound: 'danger',
    transfer: 'progress',
    adjustment: 'neutral',
    scrap: 'danger',
    qc: 'warning',
  }
  const en: Record<string, string> = {
    inbound: 'Inbound',
    outbound: 'Outbound',
    return: 'Return',
    transfer: 'Transfer',
    adjustment: 'Adjustment',
    scrap: 'Scrap',
    qc: 'QC',
  }
  const ar: Record<string, string> = {
    inbound: 'وارد',
    outbound: 'صادر',
    return: 'مرتجع',
    transfer: 'تحويل',
    adjustment: 'تعديل',
    scrap: 'إتلاف',
    qc: 'فحص جودة',
  }
  return <StatusBadge tone={tone[cat] ?? 'neutral'}>{isArabic ? ar[cat] : en[cat]}</StatusBadge>
}
