import type { ProductUom } from '@/api/products'

const UOM: Record<ProductUom, { en: string; ar: string }> = {
  piece: { en: 'Piece', ar: 'قطعة' },
  kg: { en: 'Kilogram', ar: 'كيلوغرام' },
  litre: { en: 'Litre', ar: 'لتر' },
  carton: { en: 'Carton', ar: 'كرتون' },
  pallet: { en: 'Pallet', ar: 'طبلية' },
  box: { en: 'Box', ar: 'صندوق' },
  roll: { en: 'Roll', ar: 'لفة' },
}

export const PRODUCT_UOM_VALUES = Object.keys(UOM) as ProductUom[]

export function productUomLabel(uom: ProductUom, isArabic: boolean): string {
  const row = UOM[uom]
  return row ? (isArabic ? row.ar : row.en) : uom
}

export function productStatusLabel(status: string, isArabic: boolean): string {
  const map: Record<string, { en: string; ar: string }> = {
    active: { en: 'Active', ar: 'نشط' },
    suspended: { en: 'Suspended', ar: 'موقوف' },
    archived: { en: 'Archived', ar: 'مؤرشف' },
  }
  const row = map[status]
  return row ? (isArabic ? row.ar : row.en) : status
}
