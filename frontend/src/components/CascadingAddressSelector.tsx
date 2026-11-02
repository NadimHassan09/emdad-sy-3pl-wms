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
 * Cascading Governorate (city) → City/Region (district) → Town/Neighborhood (addressLine1) selectors.
 * Strictly enforces canonical Syrian geographic hierarchy.
 */
export function CascadingAddressSelector({
  value,
  onChange,
  data = syriaAddressHierarchy,
  cityLabel = 'Governorate',
  districtLabel = 'City/Region',
  addressLine1Label = 'Town/Neighborhood',
  cityPlaceholder = 'Select governorate…',
  districtPlaceholder = 'Select city/region…',
  addressLine1Placeholder = 'Select town/neighborhood…',
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
  const neighborhoods = useMemo(
    () => listNeighborhoods(value.city, value.district, data),
    [data, value.city, value.district],
  );

  const cityOptions = useMemo(() => toComboboxOptions(cities), [cities]);
  const districtOptions = useMemo(() => toComboboxOptions(districts), [districts]);
  const addressOptions = useMemo(() => toComboboxOptions(neighborhoods), [neighborhoods]);

  return (
    <>
      <Combobox
        label={cityLabel}
        value={value.city}
        onChange={(city) => {
          const nextDistricts = listDistricts(city, data);
          const nextDistrict = nextDistricts.includes(value.district) ? value.district : '';
          const nextNeighborhoods = nextDistrict ? listNeighborhoods(city, nextDistrict, data) : [];
          const nextAddressLine1 = nextNeighborhoods.includes(value.addressLine1) ? value.addressLine1 : '';
          onChange({
            city,
            district: nextDistrict,
            addressLine1: nextAddressLine1,
          });
        }}
        options={cityOptions}
        placeholder={cityPlaceholder}
        disabled={disabled}
        required={cityRequired}
        clearable={!cityRequired}
        allowCustomValue={false}
        emptyMessage={cityOptions.length === 0 ? 'No governorates available' : 'No matches'}
      />
      <Combobox
        label={districtLabel}
        value={value.district}
        onChange={(district) => {
          const nextNeighborhoods = listNeighborhoods(value.city, district, data);
          const nextAddressLine1 = nextNeighborhoods.includes(value.addressLine1) ? value.addressLine1 : '';
          onChange({
            city: value.city,
            district,
            addressLine1: nextAddressLine1,
          });
        }}
        options={districtOptions}
        placeholder={districtPlaceholder}
        disabled={disabled || !value.city}
        required={districtRequired}
        clearable={!districtRequired}
        allowCustomValue={false}
        emptyMessage={
          !value.city
            ? 'Select a governorate first'
            : districtOptions.length === 0
              ? 'No cities available for this governorate'
              : 'No matches'
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
        disabled={disabled || !value.district}
        required={addressLine1Required}
        clearable={!addressLine1Required}
        allowCustomValue={false}
        emptyMessage={
          !value.district
            ? 'Select a city/region first'
            : addressOptions.length === 0
              ? 'No neighborhoods available for this city'
              : 'No matches'
        }
      />
    </>
  );
}
