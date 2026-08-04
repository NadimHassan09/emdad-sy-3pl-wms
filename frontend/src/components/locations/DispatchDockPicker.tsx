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

/** Shipping / dispatch dock (`output` type). */
export function DispatchDockPicker({
  warehouseId,
  value,
  onChange,
  label,
  disabled,
  required = true,
  dropdownInFlow = true,
}: Props) {
  const { t } = useWmsTranslation();
  const resolvedLabel = label ?? t(['Dispatch dock', 'رصيف الإرسال']);
  const lookup = useTypedLocationLookup(warehouseId, 'output', !!warehouseId);

  const options = useMemo(() => {
    const items = (lookup.data?.items ?? []).filter((l) => l.type === 'output');
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
          ? t(['Loading dispatch docks…', 'جاري تحميل أرصفة الإرسال…'])
          : t(['Select dispatch dock…', 'اختر رصيف الإرسال…'])
      }
      emptyMessage={
        lookup.isError
          ? t(['Failed to load dispatch docks', 'تعذّر تحميل أرصفة الإرسال'])
          : options.length === 0
            ? t([
                'No shipping dock (type output). Create one under Locations.',
                'لا يوجد رصيف شحن (نوع output). أنشئ واحداً من المواقع.',
              ])
            : t(['No locations', 'لا توجد مواقع'])
      }
    />
  );
}
