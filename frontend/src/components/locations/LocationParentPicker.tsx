import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { LocationsApi } from '../../api/locations';
import { localizedLocationTypeLabel } from '../../lib/ui-labels/locations';
import { useWmsTranslation } from '../../lib/ui-i18n';
import { Combobox } from '../Combobox';

type Props = {
  warehouseId: string;
  value: string;
  onChange: (value: string) => void;
  excludeId?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
};

export function LocationParentPicker({
  warehouseId,
  value,
  onChange,
  excludeId,
  label,
  placeholder,
  disabled,
}: Props) {
  const { t } = useWmsTranslation();
  const resolvedLabel = label ?? t(['Parent (optional)', 'الأب (اختياري)']);
  const resolvedPlaceholder =
    placeholder ?? t(['Select a parent or leave empty for root…', 'اختر موقعاً أباً أو اتركه فارغاً للجذر…']);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search typing
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(search);
    }, 200);
    return () => clearTimeout(handle);
  }, [search]);

  // Query warehouse parent locations (e.g. top 50, filtered by search query)
  const lookup = useQuery({
    queryKey: ['locations', 'parent-lookup', warehouseId, debouncedSearch, excludeId],
    queryFn: () =>
      LocationsApi.lookup({
        warehouseId,
        search: debouncedSearch.trim() || undefined,
        limit: 50,
        offset: 0,
        excludeId,
      }),
    enabled: Boolean(warehouseId),
    staleTime: 10_000,
  });

  // Query the selected location if not present in the current search page
  const selectedLocation = useQuery({
    queryKey: ['locations', 'by-id', value],
    queryFn: () => LocationsApi.getById(value),
    enabled: Boolean(value),
    staleTime: 60_000,
  });

  // Prevent cross-warehouse parent assignments: clear selection if warehouseId doesn't match
  useEffect(() => {
    if (value && selectedLocation.data && selectedLocation.data.warehouseId !== warehouseId) {
      onChange('');
    }
  }, [warehouseId, value, selectedLocation.data, onChange]);

  const options = useMemo(() => {
    const rawItems = lookup.data?.items ?? [];
    const validItems = rawItems.filter(
      (l) => l.status !== 'archived' && (!excludeId || l.id !== excludeId),
    );

    const fromApi = validItems.map((l) => {
      const typeLabel = localizedLocationTypeLabel(l.type, t);
      return {
        value: l.id,
        label: `${l.name} (${l.fullPath})`,
        hint: `${l.barcode} · ${typeLabel}`,
      };
    });

    const rootOption = {
      value: '',
      label: t(['-- None (Warehouse Root) --', '-- بدون أب (جذر المستودع) --']),
      hint: t(['Create directly under the warehouse root', 'إنشاء مباشرة في جذر المستودع']),
    };

    const combined = [rootOption, ...fromApi];

    if (value && !combined.some((o) => o.value === value)) {
      if (selectedLocation.data && selectedLocation.data.warehouseId === warehouseId) {
        const l = selectedLocation.data;
        const typeLabel = localizedLocationTypeLabel(l.type, t);
        combined.splice(1, 0, {
          value: l.id,
          label: `${l.name} (${l.fullPath})`,
          hint: `${l.barcode} · ${typeLabel}`,
        });
      } else if (selectedLocation.isLoading) {
        combined.splice(1, 0, {
          value,
          label: t(['Loading parent location…', 'جاري تحميل الموقع الأب…']),
          hint: t(['Selected parent', 'الأب المحدد']),
        });
      }
    }
    return combined;
  }, [
    lookup.data?.items,
    value,
    selectedLocation.data,
    selectedLocation.isLoading,
    warehouseId,
    excludeId,
    t,
  ]);

  const emptyMessage = useMemo(() => {
    if (!warehouseId) {
      return t(['Select a warehouse first', 'اختر مستودعاً أولاً']);
    }
    if (lookup.isLoading) {
      return t(['Loading available parents…', 'جاري تحميل المواقع المتاحة…']);
    }
    if (lookup.isError) {
      return t(['Could not load locations. Please retry.', 'تعذّر تحميل المواقع. يرجى إعادة المحاولة.']);
    }
    if (search.trim()) {
      return t(['No matching locations found', 'لا توجد مواقع مطابقة للبحث']);
    }
    return t(['No parent locations available in this warehouse', 'لا توجد مواقع أب متاحة في هذا المستودع']);
  }, [warehouseId, lookup.isLoading, lookup.isError, search, t]);

  return (
    <Combobox
      label={resolvedLabel}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={resolvedPlaceholder}
      disabled={disabled || !warehouseId}
      clearable
      onSearchQueryChange={setSearch}
      emptyMessage={emptyMessage}
    />
  );
}
