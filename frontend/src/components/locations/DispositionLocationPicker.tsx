import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { LocationsApi } from '../../api/locations';
import type { ReturnItemDisposition } from '../../api/returns';
import { QK } from '../../constants/query-keys';
import { EXECUTION_LOOKUP_LIMIT } from '../../lib/location-resolve';
import { localizedLocationTypeLabel } from '../../lib/ui-labels/locations';
import { locationTypesForDisposition } from '../../lib/return-labels';
import { useWmsTranslation } from '../../lib/ui-i18n';
import { Combobox } from '../Combobox';

const MIN_SEARCH_LEN = 2;

type Props = {
  warehouseId: string;
  disposition: ReturnItemDisposition;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
};

/** Return disposition target bin — remote lookup filtered by disposition rules. */
export function DispositionLocationPicker({
  warehouseId,
  disposition,
  value,
  onChange,
  label,
  disabled,
}: Props) {
  const { t } = useWmsTranslation();
  const resolvedLabel = label ?? t(['Target location', 'الموقع المستهدف']);
  const [search, setSearch] = useState('');
  const allowedTypes = useMemo(
    () => new Set(locationTypesForDisposition(disposition)),
    [disposition],
  );

  useEffect(() => {
    if (!value) setSearch('');
  }, [value]);

  useEffect(() => {
    setSearch('');
  }, [disposition]);

  const selectedById = useQuery({
    queryKey: QK.locations.byId(value),
    queryFn: () => LocationsApi.getById(value),
    enabled: !!value && !!warehouseId,
    staleTime: 5 * 60_000,
  });

  const singleType = allowedTypes.size === 1 ? [...allowedTypes][0] : undefined;

  const lookup = useQuery({
    queryKey: QK.locations.lookup(warehouseId, `return:${disposition}:${search}`),
    queryFn: () =>
      LocationsApi.lookup({
        warehouseId,
        search: search.trim(),
        limit: EXECUTION_LOOKUP_LIMIT,
        offset: 0,
        ...(singleType ? { type: singleType } : {}),
      }),
    enabled:
      !!warehouseId && allowedTypes.size > 0 && search.trim().length >= MIN_SEARCH_LEN,
    staleTime: 30_000,
  });

  const options = useMemo(() => {
    const fromApi = (lookup.data?.items ?? [])
      .filter((l) => allowedTypes.has(l.type))
      .map((l) => ({
        value: l.id,
        label: `${l.fullPath} (${l.type})`,
        hint: localizedLocationTypeLabel(l.type, t),
      }));

    const selected = selectedById.data;
    if (
      value &&
      selected &&
      allowedTypes.has(selected.type) &&
      !fromApi.some((o) => o.value === value)
    ) {
      return [
        {
          value: selected.id,
          label: `${selected.fullPath} (${selected.type})`,
          hint: localizedLocationTypeLabel(selected.type, t),
        },
        ...fromApi,
      ];
    }
    return fromApi;
  }, [lookup.data?.items, selectedById.data, value, allowedTypes, t]);

  if (allowedTypes.size === 0) return null;

  return (
    <Combobox
      label={resolvedLabel}
      value={value}
      onChange={onChange}
      options={options}
      disabled={disabled}
      placeholder={t(['Search Location Code or Barcode…', 'ابحث بـ Location Code أو Barcode…'])}
      onSearchQueryChange={setSearch}
      emptyMessage={
        search.trim().length < MIN_SEARCH_LEN
          ? t(['Type at least 2 characters', 'اكتب حرفين على الأقل'])
          : lookup.isFetching
            ? t(['Searching…', 'جاري البحث…'])
            : t(['No locations for this disposition', 'لا توجد مواقع لهذا التصرف'])
      }
    />
  );
}
