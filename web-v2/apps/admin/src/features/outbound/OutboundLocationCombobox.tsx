import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Combobox } from '@emdad/ui/ui/combobox'
import { Label } from '@emdad/ui/ui/label'
import { LocationsApi, type LocationType } from '@/api/locations'
import { QK } from '@/constants/query-keys'

/** White field surface (matches product picker / avoids light-green select fill). */
const FIELD_SURFACE = 'bg-white hover:bg-white dark:bg-white dark:text-foreground dark:hover:bg-white'

type Props = {
  warehouseId: string
  value: string
  onChange: (id: string) => void
  label: string
  locationType: LocationType
  required?: boolean
  disabled?: boolean
  searchPlaceholder?: string
  placeholder?: string
  emptyLabel?: string
}

export function OutboundLocationCombobox({
  warehouseId,
  value,
  onChange,
  label,
  locationType,
  required,
  disabled,
  searchPlaceholder,
  placeholder,
  emptyLabel,
}: Props) {
  const [search, setSearch] = useState('')
  const [labelById, setLabelById] = useState<Record<string, string>>({})

  const lookup = useQuery({
    queryKey: [...QK.locations.lookup(warehouseId, `${locationType}:${search}`), locationType] as const,
    queryFn: () =>
      LocationsApi.lookup({
        warehouseId,
        search: search || undefined,
        type: locationType,
        status: 'active',
        limit: 50,
      }),
    enabled: Boolean(warehouseId),
  })

  const options = useMemo(() => {
    const items =
      (lookup.data?.items ?? [])
        .filter((loc) => loc.type === locationType)
        .map((loc) => ({
          value: loc.id,
          label: loc.fullPath?.trim() || loc.name,
        }))
    if (value && !items.some((o) => o.value === value)) {
      items.unshift({
        value,
        label: labelById[value] || value,
      })
    }
    return items
  }, [lookup.data, locationType, value, labelById])

  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Combobox
        value={value}
        onChange={(id) => {
          onChange(id)
          const nextLabel = options.find((o) => o.value === id)?.label
          if (id && nextLabel) setLabelById((prev) => ({ ...prev, [id]: nextLabel }))
        }}
        options={options}
        onSearchChange={setSearch}
        placeholder={placeholder ?? label}
        searchPlaceholder={searchPlaceholder}
        emptyLabel={emptyLabel}
        disabled={disabled || !warehouseId}
        className={FIELD_SURFACE}
      />
    </div>
  )
}
