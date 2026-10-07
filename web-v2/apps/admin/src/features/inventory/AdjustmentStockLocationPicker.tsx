import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useUiPreferences } from '@emdad/core'
import { Combobox } from '@emdad/ui/ui/combobox'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import type { LocationType } from '@/api/locations'
import { LocationsApi } from '@/api/locations'
import { QK } from '@/constants/query-keys'
import { EXECUTION_LOOKUP_LIMIT } from '@/lib/location-resolve'
import { isAdjustmentStockLocationType } from '@/lib/location-types'
import { useDebounced } from '@/lib/useDebounced'

const MIN_SEARCH_LEN = 2

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
}: {
  warehouseId: string
  value: string
  onChange: (value: string) => void
  typeFilter?: '' | LocationType
  excludeId?: string
  label?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  emptyMessage?: string
}) {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const resolvedLabel = label ?? t('Location', 'الموقع')
  const resolvedPlaceholder =
    placeholder ?? t('Search Location Code or Barcode…', 'ابحث بـ Location Code أو Barcode…')

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search, 300)

  useEffect(() => {
    if (!value) setSearch('')
  }, [value])

  const selectedById = useQuery({
    queryKey: QK.locations.byId(value),
    queryFn: () => LocationsApi.getById(value),
    enabled: !!value && !!warehouseId,
    staleTime: 5 * 60_000,
  })

  const lookup = useQuery({
    queryKey: QK.locations.lookup(warehouseId, `adj:${typeFilter || 'all'}:${debouncedSearch}`),
    queryFn: () =>
      LocationsApi.lookup({
        warehouseId,
        search: debouncedSearch.trim(),
        limit: EXECUTION_LOOKUP_LIMIT,
        offset: 0,
        ...(typeFilter ? { type: typeFilter } : {}),
      }),
    enabled: !!warehouseId && debouncedSearch.trim().length >= MIN_SEARCH_LEN,
    staleTime: 30_000,
  })

  const options = useMemo(() => {
    const fromApi = (lookup.data?.items ?? [])
      .filter((l) => isAdjustmentStockLocationType(l.type))
      .filter((l) => l.id !== excludeId)
      .map((l) => ({
        value: l.id,
        label: l.fullPath || l.name,
      }))

    const selected = selectedById.data
    if (
      value &&
      selected &&
      isAdjustmentStockLocationType(selected.type) &&
      selected.id !== excludeId &&
      !fromApi.some((o) => o.value === value)
    ) {
      return [{ value: selected.id, label: selected.fullPath || selected.name }, ...fromApi]
    }
    return fromApi
  }, [lookup.data?.items, selectedById.data, value, excludeId])

  const defaultEmpty = !warehouseId
    ? t('Warehouse required.', 'يلزم تحديد مستودع.')
    : debouncedSearch.trim().length < MIN_SEARCH_LEN
      ? t('Type at least 2 characters (Location Code or Barcode)', 'اكتب حرفين على الأقل (Location Code أو Barcode)')
      : lookup.isFetching
        ? t('Searching…', 'جاري البحث…')
        : t('No matching bins', 'لا توجد Bins مطابقة')

  return (
    <div className="space-y-2">
      <Label>
        {resolvedLabel}
        {required ? ' *' : ''}
      </Label>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('Search bin…', 'ابحث عن bin…')}
        disabled={disabled || !warehouseId}
        autoComplete="off"
      />
      <Combobox
        value={value}
        onChange={onChange}
        options={options}
        placeholder={resolvedPlaceholder}
        disabled={disabled}
        emptyLabel={emptyMessage ?? defaultEmpty}
      />
      <p className="text-xs text-muted-foreground">
        {t('Type at least 2 characters to search eligible bins.', 'اكتب حرفين على الأقل للبحث عن Bins المؤهلة.')}
      </p>
    </div>
  )
}
