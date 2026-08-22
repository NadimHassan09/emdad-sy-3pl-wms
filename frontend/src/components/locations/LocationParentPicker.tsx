import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { LocationsApi } from '../../api/locations';
import { QK } from '../../constants/query-keys';
import { useWmsTranslation } from '../../lib/ui-i18n';
import { Combobox } from '../Combobox';

type Props = {
  warehouseId: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
};

export function LocationParentPicker({
  warehouseId,
  value,
  onChange,
  label,
  placeholder,
  disabled,
}: Props) {
  const { t } = useWmsTranslation();
  const resolvedLabel = label ?? t(['Parent (optional)', 'الأب (اختياري)']);
  const resolvedPlaceholder =
    placeholder ?? t(['Search by Location Code or Barcode…', 'ابحث بـ Location Code أو Barcode…']);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!value) setSearch('');
  }, [value]);

  const lookup = useQuery({
    queryKey: QK.locations.lookup(warehouseId, search),
    queryFn: () =>
      LocationsApi.lookup({
        warehouseId,
        search: search.trim() || undefined,
        limit: 25,
        offset: 0,
      }),
    enabled: !!warehouseId && search.trim().length >= 2,
    staleTime: 30_000,
  });

  const options = useMemo(() => {
    const fromApi = (lookup.data?.items ?? []).map((l) => ({
      value: l.id,
      label: l.fullPath,
      hint: l.barcode,
    }));
    if (value && !fromApi.some((o) => o.value === value)) {
      return [
        {
          value,
          label: value,
          hint: t(['Current selection', 'الاختيار الحالي']),
        },
        ...fromApi,
      ];
    }
    return fromApi;
  }, [lookup.data?.items, value, t]);

  return (
    <Combobox
      label={resolvedLabel}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={resolvedPlaceholder}
      disabled={disabled}
      clearable
      onSearchQueryChange={setSearch}
      emptyMessage={
        search.trim().length < 2
          ? t(['Type at least 2 characters to search parents', 'اكتب حرفين على الأقل للبحث عن الأب'])
          : lookup.isFetching
            ? t(['Searching…', 'جاري البحث…'])
            : t(['No matches', 'لا توجد نتائج'])
      }
    />
  );
}
