import { useMemo, type ReactElement } from 'react';

import {
  listCities,
  listDistricts,
  listNeighborhoods,
  syriaAddressHierarchy,
  toComboboxOptions,
  type CascadingAddressValue,
  type SyriaAddressHierarchy,
} from '../data/syria-address';
import { Combobox } from './Combobox';

export type CascadingAddressSelectorProps = {
  value: CascadingAddressValue;
  onChange: (next: CascadingAddressValue) => void;
  /** Override data source (defaults to bundled Syria hierarchy). */
  data?: SyriaAddressHierarchy;
  cityLabel?: string;
  districtLabel?: string;
  addressLine1Label?: string;
  cityPlaceholder?: string;
  districtPlaceholder?: string;
  addressLine1Placeholder?: string;
  disabled?: boolean;
  cityRequired?: boolean;
  districtRequired?: boolean;
  addressLine1Required?: boolean;
};

/**
 * Cascading City → District → Address Line 1 selectors.
 * Dropdown suggestions are optional — users may type any value freely.
 */
export function CascadingAddressSelector({
  value,
  onChange,
  data = syriaAddressHierarchy,
  cityLabel = 'Governorate',
  districtLabel = 'City/Region',
  addressLine1Label = 'Town/Neighborhood',
  cityPlaceholder = 'Select or type governorate…',
  districtPlaceholder = 'Select or type city/region…',
  addressLine1Placeholder = 'Select or type town/neighborhood…',
  disabled = false,
  cityRequired = false,
  districtRequired = false,
  addressLine1Required = false,
}: CascadingAddressSelectorProps): ReactElement {
  const cities = useMemo(() => listCities(data), [data]);
  const districts = useMemo(
    () => listDistricts(value.city, data),
    [data, value.city],
  );

  const cityOptions = useMemo(
    () => toComboboxOptions(cities, value.city || undefined),
    [cities, value.city],
  );

  const districtOptions = useMemo(
    () => toComboboxOptions(districts, value.district || undefined),
    [districts, value.district],
  );

  const addressOptions = useMemo(
    () =>
      toComboboxOptions(
        listNeighborhoods(value.city, value.district, data),
        value.addressLine1 || undefined,
      ),
    [data, value.city, value.district, value.addressLine1],
  );

  return (
    <>
      <Combobox
        label={cityLabel}
        value={value.city}
        onChange={(city) => {
          const knownPick = city !== '' && cities.includes(city) && city !== value.city;
          onChange({
            city,
            district: knownPick || city === '' ? '' : value.district,
            addressLine1: knownPick || city === '' ? '' : value.addressLine1,
          });
        }}
        options={cityOptions}
        placeholder={cityPlaceholder}
        disabled={disabled}
        required={cityRequired}
        clearable={!cityRequired}
        allowCustomValue
        emptyMessage={cityOptions.length === 0 ? 'No governorates available' : 'No matches'}
      />
      <Combobox
        label={districtLabel}
        value={value.district}
        onChange={(district) => {
          const knownPick =
            district !== '' && districts.includes(district) && district !== value.district;
          onChange({
            city: value.city,
            district,
            addressLine1: knownPick || district === '' ? '' : value.addressLine1,
          });
        }}
        options={districtOptions}
        placeholder={districtPlaceholder}
        disabled={disabled}
        required={districtRequired}
        clearable={!districtRequired}
        allowCustomValue
        emptyMessage={
          districtOptions.length === 0 ? 'Type a city/region or pick a governorate for suggestions' : 'No matches'
        }
      />
      <Combobox
        label={addressLine1Label}
        value={value.addressLine1}
        onChange={(addressLine1) =>
          onChange({
            city: value.city,
            district: value.district,
            addressLine1,
          })
        }
        options={addressOptions}
        placeholder={addressLine1Placeholder}
        disabled={disabled}
        required={addressLine1Required}
        clearable={!addressLine1Required}
        allowCustomValue
        emptyMessage={
          addressOptions.length === 0
            ? 'Type a town/neighborhood or pick a city/region for suggestions'
            : 'No matches'
        }
      />
    </>
  );
}
