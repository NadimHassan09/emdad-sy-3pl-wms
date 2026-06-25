import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { LocationsApi } from '../../api/locations';
import { QK } from '../../constants/query-keys';
import { EXECUTION_LOOKUP_LIMIT } from '../../lib/location-resolve';
import { isStorageLocationType } from '../../lib/location-types';
import { localizedLocationTypeLabel } from '../../lib/ui-labels/locations';
import { useWmsTranslation } from '../../lib/ui-i18n';
import { Combobox } from '../Combobox';

const MIN_SEARCH_LEN = 2;

type Props = {
  warehouseId: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
};

/** Remote search for storage-class bins (inbound receive, etc.). */
export function StorageLocationPicker({
  warehouseId,
  value,
  onChange,
  label,
  placeholder,
  required,
  disabled,
  hint,
}: Props) {
  const { t } = useWmsTranslation();
  const resolvedLabel = label ?? t(['Destination location', 'موقع الوجهة']);
  const resolvedPlaceholder =
    placeholder ?? t(['Search Location Code or Barcode…', 'ابحث بـ Location Code أو Barcode…']);
  const resolvedHint =
    hint ??
    t([
      'Type at least 2 characters. ISS aisles and docks are excluded.',
      'اكتب حرفين على الأقل. ممرات ISS والأرصفة مستثناة.',
    ]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!value) setSearch('');
  }, [value]);

  const selectedById = useQuery({
    queryKey: QK.locations.byId(value),
    queryFn: () => LocationsApi.getById(value),
    enabled: !!value && !!warehouseId,
    staleTime: 5 * 60_000,
  });

  const lookup = useQuery({
    queryKey: QK.locations.lookup(warehouseId, `storage:${search}`),
    queryFn: () =>
      LocationsApi.lookup({
        warehouseId,
        search: search.trim(),
        limit: EXECUTION_LOOKUP_LIMIT,
        offset: 0,
      }),
    enabled: !!warehouseId && search.trim().length >= MIN_SEARCH_LEN,
    staleTime: 30_000,
  });

  const options = useMemo(() => {
    const fromApi = (lookup.data?.items ?? [])
      .filter((l) => isStorageLocationType(l.type))
      .map((l) => ({
        value: l.id,
        label: l.fullPath,
        hint: `${localizedLocationTypeLabel(l.type, t)} · ${l.barcode}`,
      }));

    const selected = selectedById.data;
    if (
      value &&
      selected &&
      isStorageLocationType(selected.type) &&
      !fromApi.some((o) => o.value === value)
    ) {
      return [
        {
          value: selected.id,
          label: selected.fullPath,
          hint: `${localizedLocationTypeLabel(selected.type, t)} · ${selected.barcode}`,
        },
        ...fromApi,
      ];
    }
    if (value && !fromApi.some((o) => o.value === value) && !selected) {
      return [{ value, label: value, hint: t(['Loading…', 'جاري التحميل…']) }, ...fromApi];
    }
    return fromApi;
  }, [lookup.data?.items, selectedById.data, value, t]);

  return (
    <Combobox
      label={resolvedLabel}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={resolvedPlaceholder}
      required={required}
      disabled={disabled}
      hint={resolvedHint}
      onSearchQueryChange={setSearch}
      emptyMessage={
        !warehouseId
          ? t(['Warehouse required.', 'يلزم تحديد مستودع.'])
          : search.trim().length < MIN_SEARCH_LEN
            ? t([
                'Type at least 2 characters (Location Code or Barcode)',
                'اكتب حرفين على الأقل (Location Code أو Barcode)',
              ])
            : lookup.isFetching
              ? t(['Searching…', 'جاري البحث…'])
              : t(['No matching storage locations', 'لا توجد مواقع تخزين مطابقة'])
      }
    />
  );
}
