import type { ReturnItemDisposition } from '../api/returns';

export const DISPOSITION_LABELS: Record<ReturnItemDisposition, { en: string; ar: string }> = {
  restock: { en: 'Restock', ar: 'إعادة للمخزون' },
  quarantine: { en: 'Quarantine', ar: 'حجر' },
  damaged: { en: 'Damaged', ar: 'تالف' },
  discard: { en: 'Discard', ar: 'إتلاف' },
  scrap: { en: 'Discard', ar: 'إتلاف' },
  inspection_required: { en: 'Inspection required', ar: 'يتطلب فحص' },
};

export function dispositionLabel(d: ReturnItemDisposition | null | undefined, isArabic: boolean): string {
  if (!d) return '—';
  const row = DISPOSITION_LABELS[d];
  return isArabic ? row.ar : row.en;
}

/** Location types allowed per disposition (warehouse floor). */
export function locationTypesForDisposition(
  disposition: ReturnItemDisposition,
): string[] {
  switch (disposition) {
    case 'restock':
      return ['internal', 'fridge'];
    case 'quarantine':
    case 'damaged':
      return ['quarantine', 'scrap'];
    case 'discard':
    case 'scrap':
      return ['scrap'];
    case 'inspection_required':
      return [];
    default:
      return [];
  }
}

export function canPostDisposition(disposition: ReturnItemDisposition | null | undefined): boolean {
  return (
    !!disposition &&
    disposition !== 'inspection_required'
  );
}
