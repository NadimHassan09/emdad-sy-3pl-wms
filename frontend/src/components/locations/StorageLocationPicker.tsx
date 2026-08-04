import { useQueries, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import type { LocationType } from '../../api/locations';
import { LocationsApi } from '../../api/locations';
import { QK } from '../../constants/query-keys';
import { EXECUTION_LOOKUP_LIMIT } from '../../lib/location-resolve';
import { isStorageLocationType } from '../../lib/location-types';
import { localizedLocationTypeLabel } from '../../lib/ui-labels/locations';
import { useWmsTranslation } from '../../lib/ui-i18n';
import { Combobox } from '../Combobox';

/** Preload these types so the putaway picker opens with a scrollable list (no typing required). */
const STORAGE_PRELOAD_TYPES: LocationType[] = ['internal', 'fridge', 'packing', 'quarantine'];

type Props = {
  warehouseId: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
  /** Keep the list attached under the field (avoids portaled/fixed float gaps). */
  dropdownInFlow?: boolean;
};

/** Storage-class bins for inbound putaway planning. */
export function StorageLocationPicker({
  warehouseId,
  value,
  onChange,
  label,
  placeholder,
  required,
  disabled,
  hint,
  dropdownInFlow = true,
}: Props) {
  const { t } = useWmsTranslation();
  const resolvedLabel = label ?? t(['Destination location', 'موقع الوجهة']);
  const resolvedPlaceholder =
    placeholder ?? t(['Select storage location…', 'اختر موقع التخزين…']);
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

  const typeQueries = useQueries({
    queries: STORAGE_PRELOAD_TYPES.map((type) => ({
      queryKey: ['locations', 'lookup', 'typed', warehouseId, type] as const,
      queryFn: () =>
        LocationsApi.lookup({
          warehouseId,
          type,
          status: 'active',
          limit: EXECUTION_LOOKUP_LIMIT,
          offset: 0,
        }),
      enabled: !!warehouseId,
      staleTime: 5 * 60_000,
    })),
  });

  const searchLookup = useQuery({
    queryKey: QK.locations.lookup(warehouseId, `storage:${search}`),
    queryFn: () =>
      LocationsApi.lookup({
        warehouseId,
        search: search.trim(),
        status: 'active',
        limit: EXECUTION_LOOKUP_LIMIT,
        offset: 0,
      }),
    enabled: !!warehouseId && search.trim().length >= 2,
    staleTime: 30_000,
  });

  const options = useMemo(() => {
    const seen = new Set<string>();
    const rows: Array<{ value: string; label: string; hint: string }> = [];

    const add = (l: {
      id: string;
      fullPath: string;
      type: string;
      barcode: string;
      status?: string;
    }) => {
      if (seen.has(l.id)) return;
      if (l.status === 'blocked' || l.status === 'archived') return;
      if (!isStorageLocationType(l.type)) return;
      seen.add(l.id);
      rows.push({
        value: l.id,
        label: l.fullPath,
        hint: `${localizedLocationTypeLabel(l.type, t)} · ${l.barcode}`,
      });
    };

    for (const q of typeQueries) {
      for (const l of q.data?.items ?? []) add(l);
    }
    for (const l of searchLookup.data?.items ?? []) add(l);

    rows.sort((a, b) => a.label.localeCompare(b.label));

    const selected = selectedById.data;
    if (value && selected && isStorageLocationType(selected.type) && !seen.has(value)) {
      rows.unshift({
        value: selected.id,
        label: selected.fullPath,
        hint: `${localizedLocationTypeLabel(selected.type, t)} · ${selected.barcode}`,
      });
    }
    if (value && !seen.has(value) && !selected) {
      rows.unshift({
        value,
        label: value,
        hint: t(['Loading…', 'جاري التحميل…']),
      });
    }
    return rows;
  }, [searchLookup.data?.items, selectedById.data, t, typeQueries, value]);

  const isLoadingList = typeQueries.some((q) => q.isLoading);

  return (
    <Combobox
      label={resolvedLabel || undefined}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={resolvedPlaceholder}
      required={required}
      disabled={disabled}
      hint={hint || undefined}
      dropdownInFlow={dropdownInFlow}
      onSearchQueryChange={setSearch}
      emptyMessage={
        !warehouseId
          ? t(['Warehouse required.', 'يلزم تحديد مستودع.'])
          : isLoadingList
            ? t(['Loading locations…', 'جاري تحميل المواقع…'])
            : search.trim().length >= 2 && searchLookup.isFetching
              ? t(['Searching…', 'جاري البحث…'])
              : t(['No matching storage locations', 'لا توجد مواقع تخزين مطابقة'])
      }
    />
  );
}
