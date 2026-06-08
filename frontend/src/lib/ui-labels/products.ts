import type { ProductUom } from '../../api/products';
import type { LocalizedMessage } from '../ui-i18n';

/** UOM display labels (unit names translated; field label stays "UOM"). */
export const PRODUCT_UOM_MESSAGES: Record<ProductUom, LocalizedMessage> = {
  piece: ['Piece', 'قطعة'],
  kg: ['Kilogram', 'كيلوغرام'],
  litre: ['Litre', 'لتر'],
  carton: ['Carton', 'كرتون'],
  pallet: ['Pallet', 'طبلية'],
  box: ['Box', 'صندوق'],
  roll: ['Roll', 'لفة'],
};

export function productUomLabel(
  uom: ProductUom,
  t: (message: LocalizedMessage) => string,
): string {
  const msg = PRODUCT_UOM_MESSAGES[uom];
  return msg ? t(msg) : uom;
}

export function productStatusLabel(
  status: string,
  t: (message: LocalizedMessage) => string,
): string {
  const map: Record<string, LocalizedMessage> = {
    active: ['Active', 'نشط'],
    suspended: ['Suspended', 'موقوف'],
    archived: ['Archived', 'مؤرشف'],
  };
  const msg = map[status];
  return msg ? t(msg) : status;
}
