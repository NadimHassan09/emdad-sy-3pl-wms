import { useQueries, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { LocationsApi } from '../../../api/locations';
import { Combobox } from '../../../components/Combobox';
import { QK } from '../../../constants/query-keys';
import {
  isAllowedPutawayDestination,
  locationTypeLabel,
  putawayDestinationTypes,
} from '../../../lib/location-types';

import { EXECUTION_LOOKUP_LIMIT } from '../../../lib/location-resolve';
import { useWmsTranslation } from '../../../lib/ui-i18n';

type Props = {
  warehouseId: string;
  taskType: 'putaway' | 'putaway_quarantine';
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Render dropdown in document flow so table pagination does not cover it. */
  dropdownInFlow?: boolean;
};

export function PutawayDestinationPicker({
  warehouseId,
  taskType,
  value,
  onChange,
  disabled,
  dropdownInFlow = true,
}: Props) {
  const { t } = useWmsTranslation();
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!value) setSearch('');
  }, [value]);

  const allowedTypes = useMemo(() => putawayDestinationTypes(taskType), [taskType]);

  const selectedById = useQuery({
    queryKey: QK.locations.byId(value),
    queryFn: () => LocationsApi.getById(value),
    enabled: !!value && !!warehouseId,
    staleTime: 5 * 60_000,
  });

  const typeQueries = useQueries({
    queries: allowedTypes.map((type) => ({
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
    queryKey: QK.locations.putawayLookup(warehouseId, taskType, search),
    queryFn: () =>
      LocationsApi.lookup({
        warehouseId,
        search: search.trim(),
        limit: EXECUTION_LOOKUP_LIMIT,
        offset: 0,
        status: 'active',
      }),
    enabled: !!warehouseId && search.trim().length >= 2,
    staleTime: 30_000,
  });

  const options = useMemo(() => {
    const allowed = new Set(allowedTypes);
    const seen = new Set<string>();
    const rows: Array<{ value: string; label: string; hint: string }> = [];

    const addLocation = (l: {
      id: string;
      fullPath: string;
      type: string;
      barcode: string;
      status?: string;
    }) => {
      if (seen.has(l.id)) return;
      if (l.status === 'blocked' || l.status === 'archived') return;
      if (!allowed.has(l.type as (typeof allowedTypes)[number])) return;
      if (!isAllowedPutawayDestination(l.type, taskType)) return;
      seen.add(l.id);
      rows.push({
        value: l.id,
        label: l.fullPath,
        hint: `${locationTypeLabel(l.type)} · ${l.barcode}`,
      });
    };

    for (const q of typeQueries) {
      for (const l of q.data?.items ?? []) addLocation(l);
    }
    for (const l of searchLookup.data?.items ?? []) addLocation(l);

    rows.sort((a, b) => a.label.localeCompare(b.label));

    const selected = selectedById.data;
    if (
      value &&
      selected &&
      isAllowedPutawayDestination(selected.type, taskType) &&
      !seen.has(value)
    ) {
      rows.unshift({
        value: selected.id,
        label: selected.fullPath,
        hint: `${locationTypeLabel(selected.type)} · ${selected.barcode}`,
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
  }, [
    allowedTypes,
    searchLookup.data?.items,
    selectedById.data,
    taskType,
    t,
    typeQueries,
    value,
  ]);

  const isLoadingList = typeQueries.some((q) => q.isLoading);

  return (
    <Combobox
      value={value}
      onChange={onChange}
      options={options}
      placeholder={t(['Select storage bin…', 'اختر صندوق تخزين…'])}
      disabled={disabled}
      clearable
      dropdownInFlow={dropdownInFlow}
      onSearchQueryChange={setSearch}
      emptyMessage={
        isLoadingList
          ? t(['Loading locations…', 'جاري تحميل المواقع…'])
          : search.trim().length >= 2 && searchLookup.isFetching
            ? t(['Searching…', 'جاري البحث…'])
            : t(['No matching storage bins', 'لا توجد صناديق تخزين مطابقة'])
      }
    />
  );
}
