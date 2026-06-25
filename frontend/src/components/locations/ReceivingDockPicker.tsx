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
};

/** Receiving dock (`input` type) — at most 25 rows from typed lookup. */
export function ReceivingDockPicker({
  warehouseId,
  value,
  onChange,
  label,
  disabled,
}: Props) {
  const { t } = useWmsTranslation();
  const resolvedLabel = label ?? t(['Receiving dock', 'رصيف الاستلام']);
  const dockLookup = useTypedLocationLookup(warehouseId, 'input', !!warehouseId);

  const options = useMemo(() => {
    const items = (dockLookup.data?.items ?? []).filter((l) => l.type === 'input');
    return items.map((l: Location) => ({
      value: l.id,
      label: l.fullPath,
      hint: `${localizedLocationTypeLabel(l.type, t)} · ${l.barcode}`,
    }));
  }, [dockLookup.data?.items, t]);

  return (
    <Combobox
      label={resolvedLabel}
      required
      value={value}
      onChange={onChange}
      options={options}
      disabled={disabled || dockLookup.isLoading}
      placeholder={
        dockLookup.isLoading
          ? t(['Loading docks…', 'جاري تحميل الأرصفة…'])
          : t(['Select receiving dock…', 'اختر رصيف الاستلام…'])
      }
      emptyMessage={
        dockLookup.isError
          ? t(['Failed to load docks', 'تعذّر تحميل الأرصفة'])
          : options.length === 0
            ? t([
                'No receiving dock (type input). Create one under Locations.',
                'لا يوجد رصيف استلام (نوع input). أنشئ واحداً من المواقع.',
              ])
            : t(['No locations', 'لا توجد مواقع'])
      }
    />
  );
}
