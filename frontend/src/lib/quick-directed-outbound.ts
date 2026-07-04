import type { QuickDirectedOutboundReasonCode } from '../api/outbound';

export const QUICK_DIRECTED_OUTBOUND_REF_PREFIX = 'QDO-';

export const QUICK_DIRECTED_REASON_OPTIONS: Array<{
  value: QuickDirectedOutboundReasonCode;
  labelEn: string;
  labelAr: string;
}> = [
  { value: 'consumption', labelEn: 'Consumption', labelAr: 'استهلاك' },
  { value: 'damage', labelEn: 'Damage', labelAr: 'تلف' },
  { value: 'sample', labelEn: 'Sample', labelAr: 'عينة' },
  { value: 'scrap', labelEn: 'Scrap', labelAr: 'إتلاف' },
  { value: 'other', labelEn: 'Other', labelAr: 'أخرى' },
];

export function quickDirectedReasonFromReference(
  clientReference: string | null | undefined,
): QuickDirectedOutboundReasonCode | null {
  if (!clientReference?.startsWith(QUICK_DIRECTED_OUTBOUND_REF_PREFIX)) return null;
  const code = clientReference.slice(QUICK_DIRECTED_OUTBOUND_REF_PREFIX.length);
  return QUICK_DIRECTED_REASON_OPTIONS.some((option) => option.value === code)
    ? (code as QuickDirectedOutboundReasonCode)
    : null;
}

export function quickDirectedReasonLabel(
  reasonCode: string | null | undefined,
  isArabic: boolean,
): string {
  if (!reasonCode) return '—';
  const option = QUICK_DIRECTED_REASON_OPTIONS.find((item) => item.value === reasonCode);
  if (!option) return reasonCode;
  return isArabic ? option.labelAr : option.labelEn;
}
