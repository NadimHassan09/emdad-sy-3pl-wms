import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Combobox } from '@emdad/ui/ui/combobox'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { LocationsApi, type LocationType } from '@/api/locations'
import { QK } from '@/constants/query-keys'

type Props = {
  warehouseId: string
  value: string
  onChange: (id: string) => void
  label: string
  locationType: LocationType
  required?: boolean
  disabled?: boolean
  searchPlaceholder?: string
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
}: Props) {
  const [search, setSearch] = useState('')
  const lookup = useQuery({
    queryKey: QK.locations.lookup(warehouseId, `${locationType}:${search}`),
    queryFn: () =>
      LocationsApi.lookup({
        warehouseId,
        search: search || undefined,
        type: locationType,
        limit: 30,
      }),
    enabled: Boolean(warehouseId),
  })

  const options =
    lookup.data?.items.map((loc) => ({
      value: loc.id,
      label: loc.fullPath?.trim() || loc.name,
    })) ?? []

  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={searchPlaceholder ?? label}
        disabled={disabled || !warehouseId}
      />
      <Combobox
        value={value}
        onChange={onChange}
        options={options}
        placeholder={label}
        disabled={disabled || !warehouseId}
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Location ID"
        disabled={disabled || !warehouseId}
        className="font-mono text-xs"
      />
    </div>
  )
}
