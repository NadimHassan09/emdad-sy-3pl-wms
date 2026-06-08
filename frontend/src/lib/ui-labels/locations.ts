import type { LocationType } from '../../api/locations';
import type { LocalizedMessage } from '../ui-i18n';
import { isManagedLocationApiType, LOCATION_TYPE_OPTIONS } from '../location-types';

type TFn = (message: LocalizedMessage) => string;

const LOCATION_TYPE_LABELS: Record<string, LocalizedMessage> = {
  iss: ['Aisle', 'ممر'],
  internal: ['Storage', 'تخزين'],
  fridge: ['Fridge', 'ثلاجة'],
  packing: ['Packing', 'تغليف'],
  input: ['Receiving dock', 'رصيف استلام'],
  output: ['Shipping dock', 'رصيف شحن'],
  quarantine: ['Quarantine', 'حجر'],
  scrap: ['Scrap', 'خردة'],
};

const LOCATION_TYPE_HINTS: Record<string, LocalizedMessage> = {
  iss: [
    'Structure / hierarchy only — not used in operations or tasks.',
    'هيكل/تسلسل فقط — لا يُستخدم في العمليات أو المهام.',
  ],
  internal: ['Used in putaway tasks.', 'يُستخدم في مهام التخزين.'],
  fridge: ['Cold storage — used in putaway tasks.', 'تخزين بارد — يُستخدم في مهام التخزين.'],
  packing: ['Used in packing tasks.', 'يُستخدم في مهام التغليف.'],
  input: [
    'Used in inbound receiving tasks (deferred-putaway dock).',
    'يُستخدم في مهام استلام الوارد (رصيف استلام).',
  ],
  output: ['Used in delivery tasks.', 'يُستخدم في مهام التسليم.'],
  quarantine: ['Used in putaway tasks (hold / quality issues).', 'يُستخدم في مهام التخزين (حجز / جودة).'],
  scrap: ['Used in putaway tasks.', 'يُستخدم في مهام التخزين.'],
};

export function localizedLocationTypeLabel(type: string | null | undefined, t: TFn): string {
  if (!type) return '—';
  const msg = LOCATION_TYPE_LABELS[type];
  return msg ? t(msg) : type;
}

export function localizedLocationTypeHint(type: string | null | undefined, t: TFn): string | undefined {
  if (!type) return undefined;
  const msg = LOCATION_TYPE_HINTS[type];
  return msg ? t(msg) : undefined;
}

export function localizedLocationTypeSelectOptions(t: TFn): { value: LocationType; label: string; hint: string }[] {
  return LOCATION_TYPE_OPTIONS.map((o) => ({
    value: o.value,
    label: localizedLocationTypeLabel(o.value, t),
    hint: localizedLocationTypeHint(o.value, t) ?? '',
  }));
}

export function localizedManagedTypeOptionsForEdit(
  locationType: string | null | undefined,
  t: TFn,
): { value: LocationType; label: string; hint: string }[] {
  const base = localizedLocationTypeSelectOptions(t);
  if (locationType && !isManagedLocationApiType(locationType)) {
    if (locationType === 'qc') return base;
    return [
      ...base,
      {
        value: locationType as LocationType,
        label: t([`${locationType} (legacy)`, `${locationType} (قديم)`]),
        hint: t([
          'Existing location type — migrate to a standard type when possible.',
          'نوع موقع قديم — يُفضّل الترحيل إلى نوع قياسي عند الإمكان.',
        ]),
      },
    ];
  }
  return base;
}

export function localizedLocationStatusLabel(status: string, t: TFn): string {
  const map: Record<string, LocalizedMessage> = {
    active: ['Active', 'نشط'],
    blocked: ['Suspended', 'موقوف'],
    archived: ['Archived', 'مؤرشف'],
  };
  const msg = map[status];
  return msg ? t(msg) : status;
}

/** DataTable pagination labels for locations views. */
export function dataTablePaginationLabels(t: TFn) {
  return {
    rowsSuffix: t(['rows', 'صفوف']),
    resultsSuffix: t(['results', 'نتيجة']),
    ofWord: t(['of', 'من']),
    previous: t(['Previous', 'السابق']),
    next: t(['Next', 'التالي']),
    rowsPerPageAria: t(['Rows per page', 'عدد الصفوف لكل صفحة']),
  };
}
