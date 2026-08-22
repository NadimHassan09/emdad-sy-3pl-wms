import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import type { LocationType } from '../../api/locations';
import { LocationsApi } from '../../api/locations';
import { QK } from '../../constants/query-keys';
import { EXECUTION_LOOKUP_LIMIT } from '../../lib/location-resolve';
import { isAdjustmentStockLocationType } from '../../lib/location-types';
import { localizedLocationTypeLabel } from '../../lib/ui-labels/locations';
import { useWmsTranslation } from '../../lib/ui-i18n';
import { Combobox } from '../Combobox';

const MIN_SEARCH_LEN = 2;

type Props = {
  warehouseId: string;
  value: string;
  onChange: (value: string) => void;
  /** Single API type filter; omit to allow all adjustment-stock types. */
  typeFilter?: '' | LocationType;
  excludeId?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  emptyMessage?: string;
};

/** Remote search for internal / fridge / quarantine / scrap bins (transfers, etc.). */
export function AdjustmentStockLocationPicker({
  warehouseId,
  value,
  onChange,
  typeFilter = '',
  excludeId,
  label,
  placeholder,
  required,
  disabled,
  emptyMessage,
}: Props) {
  const { t } = useWmsTranslation();
  const resolvedLabel = label ?? t(['Location', 'الموقع']);
  const resolvedPlaceholder =
    placeholder ?? t(['Search Location Code or Barcode…', 'ابحث بـ Location Code أو Barcode…']);
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
    queryKey: QK.locations.lookup(warehouseId, `adj:${typeFilter || 'all'}:${search}`),
    queryFn: () =>
      LocationsApi.lookup({
        warehouseId,
        search: search.trim(),
        limit: EXECUTION_LOOKUP_LIMIT,
        offset: 0,
        ...(typeFilter ? { type: typeFilter } : {}),
      }),
    enabled: !!warehouseId && search.trim().length >= MIN_SEARCH_LEN,
    staleTime: 30_000,
  });

  const options = useMemo(() => {
    const fromApi = (lookup.data?.items ?? [])
      .filter((l) => isAdjustmentStockLocationType(l.type))
      .filter((l) => l.id !== excludeId)
      .map((l) => ({
        value: l.id,
        label: l.fullPath,
        hint: `${localizedLocationTypeLabel(l.type, t)} · ${l.barcode}`,
      }));

    const selected = selectedById.data;
    if (
      value &&
      selected &&
      isAdjustmentStockLocationType(selected.type) &&
      selected.id !== excludeId &&
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
    return fromApi;
  }, [lookup.data?.items, selectedById.data, value, excludeId, t]);

  const defaultEmpty =
    !warehouseId
      ? t(['Warehouse required.', 'يلزم تحديد مستودع.'])
      : search.trim().length < MIN_SEARCH_LEN
        ? t([
            'Type at least 2 characters (Location Code or Barcode)',
            'اكتب حرفين على الأقل (Location Code أو Barcode)',
          ])
        : lookup.isFetching
          ? t(['Searching…', 'جاري البحث…'])
          : t(['No matching bins', 'لا توجد Bins مطابقة']);

  return (
    <Combobox
      label={resolvedLabel}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={resolvedPlaceholder}
      required={required}
      disabled={disabled}
      hint={t([
        'Type at least 2 characters to search eligible bins.',
        'اكتب حرفين على الأقل للبحث عن Bins المؤهلة.',
      ])}
      onSearchQueryChange={setSearch}
      emptyMessage={emptyMessage ?? defaultEmpty}
    />
  );
}
