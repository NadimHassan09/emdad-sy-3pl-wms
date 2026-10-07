import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Combobox } from '@emdad/ui/ui/combobox'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import type { ReturnItemDisposition } from '@/api/returns'
import { LocationsApi, type LocationType } from '@/api/locations'
import { QK } from '@/constants/query-keys'
import { locationTypesForDisposition } from '@/lib/return-labels'

type Props = {
  warehouseId: string
  disposition: ReturnItemDisposition
  value: string
  onChange: (id: string) => void
  label: string
  disabled?: boolean
}

export function DispositionLocationPicker({
  warehouseId,
  disposition,
  value,
  onChange,
  label,
  disabled,
}: Props) {
  const [search, setSearch] = useState('')
  const types = locationTypesForDisposition(disposition)

  const lookup = useQuery({
    queryKey: QK.locations.lookup(warehouseId, `disposition:${disposition}:${search}`),
    queryFn: async () => {
      if (types.length === 0) return { items: [], total: 0, limit: 25, offset: 0 }
      const results = await Promise.all(
        types.map((type) =>
          LocationsApi.lookup({
            warehouseId,
            search: search || undefined,
            type: type as LocationType,
            limit: 15,
          }),
        ),
      )
      const merged = results.flatMap((r) => r.items)
      const seen = new Set<string>()
      const items = merged.filter((loc) => {
        if (seen.has(loc.id)) return false
        seen.add(loc.id)
        return true
      })
      return { items, total: items.length, limit: 25, offset: 0 }
    },
    enabled: Boolean(warehouseId) && types.length > 0,
  })

  const options = useMemo(
    () =>
      (lookup.data?.items ?? []).map((loc) => ({
        value: loc.id,
        label: loc.fullPath?.trim() || loc.name,
      })),
    [lookup.data],
  )

  if (types.length === 0) return null

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={label}
        disabled={disabled || !warehouseId}
      />
      <Combobox value={value} onChange={onChange} options={options} placeholder={label} disabled={disabled || !warehouseId} />
    </div>
  )
}
