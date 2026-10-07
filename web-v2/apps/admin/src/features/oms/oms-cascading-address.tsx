import { useMemo } from 'react'
import { Label } from '@emdad/ui/ui/label'
import { Input } from '@emdad/ui/ui/input'
import {
  listCities,
  listDistricts,
  listNeighborhoods,
  syriaAddressHierarchy,
  type CascadingAddressValue,
} from '@/data/syria-address'

type Props = {
  value: CascadingAddressValue
  onChange: (next: CascadingAddressValue) => void
  disabled?: boolean
  cityLabel: string
  districtLabel: string
  addressLine1Label: string
  cityRequired?: boolean
  districtRequired?: boolean
  addressLine1Required?: boolean
}

function DatalistInput({
  id,
  listId,
  value,
  onChange,
  disabled,
  required,
  placeholder,
  options,
}: {
  id: string
  listId: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  required?: boolean
  placeholder?: string
  options: string[]
}) {
  return (
    <>
      <Input
        id={id}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        className="text-sm"
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  )
}

/** City → district → neighborhood with Syria hierarchy suggestions (free text allowed). */
export function OmsCascadingAddressFields({
  value,
  onChange,
  disabled,
  cityLabel,
  districtLabel,
  addressLine1Label,
  cityRequired,
  districtRequired,
  addressLine1Required,
}: Props) {
  const cities = useMemo(() => listCities(syriaAddressHierarchy), [])
  const districts = useMemo(
    () => listDistricts(value.city, syriaAddressHierarchy),
    [value.city],
  )
  const neighborhoods = useMemo(
    () => listNeighborhoods(value.city, value.district, syriaAddressHierarchy),
    [value.city, value.district],
  )

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="oms-addr-city" className="text-sm">
          {cityLabel}
          {cityRequired ? <span className="text-destructive ms-0.5">*</span> : null}
        </Label>
        <DatalistInput
          id="oms-addr-city"
          listId="oms-addr-city-list"
          value={value.city}
          onChange={(city) => {
            const knownPick = city !== '' && cities.includes(city) && city !== value.city
            onChange({
              city,
              district: knownPick || city === '' ? '' : value.district,
              addressLine1: knownPick || city === '' ? '' : value.addressLine1,
            })
          }}
          disabled={disabled}
          required={cityRequired}
          options={cities}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="oms-addr-district" className="text-sm">
          {districtLabel}
          {districtRequired ? <span className="text-destructive ms-0.5">*</span> : null}
        </Label>
        <DatalistInput
          id="oms-addr-district"
          listId="oms-addr-district-list"
          value={value.district}
          onChange={(district) => {
            const knownPick =
              district !== '' && districts.includes(district) && district !== value.district
            onChange({
              city: value.city,
              district,
              addressLine1: knownPick || district === '' ? '' : value.addressLine1,
            })
          }}
          disabled={disabled}
          required={districtRequired}
          options={districts}
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="oms-addr-line1" className="text-sm">
          {addressLine1Label}
          {addressLine1Required ? <span className="text-destructive ms-0.5">*</span> : null}
        </Label>
        <DatalistInput
          id="oms-addr-line1"
          listId="oms-addr-line1-list"
          value={value.addressLine1}
          onChange={(addressLine1) =>
            onChange({ city: value.city, district: value.district, addressLine1 })
          }
          disabled={disabled}
          required={addressLine1Required}
          options={neighborhoods}
        />
      </div>
    </>
  )
}
