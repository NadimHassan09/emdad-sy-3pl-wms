import { useMemo } from 'react';

import type { Location } from '../../api/locations';
import { useTypedLocationLookup } from '../../hooks/useTypedLocationLookup';
import { localizedLocationTypeLabel } from '../../lib/ui-labels/locations';
import { useWmsTranslation } from '../../lib/ui-i18n';
import { Combobox } from '../Combobox';

type Props = {
  warehouseId: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  required?: boolean;
  /** Keep the list attached under the field (avoids portaled/fixed float gaps). */
  dropdownInFlow?: boolean;
};

/** Packing station (`packing` type). */
export function PackingLocationPicker({
  warehouseId,
  value,
  onChange,
  label,
  disabled,
  required = true,
  dropdownInFlow = true,
}: Props) {
  const { t } = useWmsTranslation();
  const resolvedLabel = label ?? t(['Packing location', 'موقع التغليف']);
  const lookup = useTypedLocationLookup(warehouseId, 'packing', !!warehouseId);

  const options = useMemo(() => {
    const items = (lookup.data?.items ?? []).filter((l) => l.type === 'packing');
    return items.map((l: Location) => ({
      value: l.id,
      label: l.fullPath,
      hint: `${localizedLocationTypeLabel(l.type, t)} · ${l.barcode}`,
    }));
  }, [lookup.data?.items, t]);

  return (
    <Combobox
      label={resolvedLabel}
      required={required}
      value={value}
      onChange={onChange}
      options={options}
      disabled={disabled || lookup.isLoading}
      dropdownInFlow={dropdownInFlow}
      placeholder={
        lookup.isLoading
          ? t(['Loading packing locations…', 'جاري تحميل مواقع التغليف…'])
          : t(['Select packing location…', 'اختر موقع التغليف…'])
      }
      emptyMessage={
        lookup.isError
          ? t(['Failed to load packing locations', 'تعذّر تحميل مواقع التغليف'])
          : options.length === 0
            ? t([
                'No packing location. Create one under Locations (type packing).',
                'لا يوجد موقع تغليف. أنشئ واحداً من المواقع (نوع packing).',
              ])
            : t(['No locations', 'لا توجد مواقع'])
      }
    />
  );
}
