import type { LedgerRow } from '@/api/inventory'

export const fmtLedgerQty = (s: string | null | undefined): string => {
  if (s == null || s === '') return '—'
  const n = Number(s)
  if (Number.isNaN(n)) return String(s)
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

function parseQty(s: string | null | undefined): number | null {
  if (s == null || s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Prefer API `quantityChange` (already signed). */
export function ledgerSignedChange(row: LedgerRow): number {
  const n = parseQty(row.quantityChange)
  return n ?? 0
}

export function fmtSignedDelta(n: number): string {
  const absFmt = Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 4 })
  if (n > 0) return `+${absFmt}`
  if (n < 0) return `-${absFmt}`
  return '0'
}

export type LedgerMovementCategory =
  | 'inbound'
  | 'outbound'
  | 'return'
  | 'adjustment'
  | 'transfer'
  | 'scrap'
  | 'qc'

const MOVEMENT_INBOUND = new Set(['inbound', 'inbound_receive', 'transit_in'])
const MOVEMENT_OUTBOUND = new Set(['outbound', 'outbound_pick', 'transit_out'])
const MOVEMENT_RETURN = new Set(['return', 'return_receive'])
const MOVEMENT_TRANSFER = new Set(['transfer', 'internal_transfer'])
const MOVEMENT_SCRAP = new Set(['scrap'])
const MOVEMENT_QC = new Set(['qc', 'qc_quarantine', 'qc_release'])

export function ledgerMovementCategory(raw: string): LedgerMovementCategory {
  const k = raw.trim()
  if (MOVEMENT_INBOUND.has(k)) return 'inbound'
  if (MOVEMENT_OUTBOUND.has(k)) return 'outbound'
  if (MOVEMENT_RETURN.has(k)) return 'return'
  if (MOVEMENT_TRANSFER.has(k)) return 'transfer'
  if (MOVEMENT_SCRAP.has(k)) return 'scrap'
  if (MOVEMENT_QC.has(k)) return 'qc'
  return 'adjustment'
}

export function ledgerMovementLabel(cat: LedgerMovementCategory, isArabic?: boolean): string {
  const en: Record<LedgerMovementCategory, string> = {
    inbound: 'Inbound',
    outbound: 'Outbound',
    return: 'Return',
    transfer: 'Transfer',
    scrap: 'Scrap',
    qc: 'QC',
    adjustment: 'Adjustment',
  }
  const ar: Record<LedgerMovementCategory, string> = {
    inbound: 'وارد',
    outbound: 'صادر',
    return: 'مرتجع',
    transfer: 'تحويل',
    scrap: 'إتلاف',
    qc: 'فحص جودة',
    adjustment: 'تعديل',
  }
  return isArabic ? ar[cat] : en[cat]
}

export function ledgerLotLocationBucketKey(r: LedgerRow): string {
  const lot = r.lotId ?? r.lot?.id ?? ''
  return `${r.productId}:${lot}:${r.fromLocationId ?? ''}:${r.toLocationId ?? ''}`
}

export type MergedLotLocationLine = {
  key: string
  lotNumber: string
  locationDescription: string
  delta: number
}

export function describeLedgerLocations(r: LedgerRow): string {
  if (r.locationLabel) return r.locationLabel
  if (r.fromLocationId && r.toLocationId && r.fromLocationId !== r.toLocationId) {
    return `${r.fromLocationId.slice(0, 8)}… → ${r.toLocationId.slice(0, 8)}…`
  }
  if (r.fromLocationId && !r.toLocationId) return `From ${r.fromLocationId.slice(0, 8)}…`
  if (r.toLocationId && !r.fromLocationId) return `To ${r.toLocationId.slice(0, 8)}…`
  return '—'
}

export function mergeLedgerLinesByLotAndLocation(lines: LedgerRow[]): MergedLotLocationLine[] {
  const groups = new Map<string, LedgerRow[]>()
  for (const r of lines) {
    const k = ledgerLotLocationBucketKey(r)
    const cur = groups.get(k) ?? []
    cur.push(r)
    groups.set(k, cur)
  }
  const out: MergedLotLocationLine[] = []
  for (const [key, group] of groups) {
    group.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    const first = group[0]!
    const delta = group.reduce((s, r) => s + ledgerSignedChange(r), 0)
    out.push({
      key,
      lotNumber: first.lot?.lotNumber ?? '—',
      locationDescription: describeLedgerLocations(first),
      delta,
    })
  }
  return out
}

export function ledgerEntryDetailPath(ledgerId: string, createdAt: string, companyId?: string): string {
  const base = `/inventory/ledger/line/${encodeURIComponent(ledgerId)}/${encodeURIComponent(createdAt)}`
  return companyId ? `${base}?companyId=${encodeURIComponent(companyId)}` : base
}

export function ledgerReferenceAdminPath(referenceType: string, referenceId: string): string | null {
  switch (referenceType) {
    case 'inbound_order':
      return `/orders/inbound/${referenceId}`
    case 'outbound_order':
      return `/orders/outbound/${referenceId}`
    case 'adjustment':
      return `/inventory/adjustments/${encodeURIComponent(referenceId)}`
    default:
      return null
  }
}

export function ledgerReferenceListPath(referenceType: string, referenceId: string): string {
  return `/inventory/ledger/${encodeURIComponent(referenceType)}/${encodeURIComponent(referenceId)}`
}
