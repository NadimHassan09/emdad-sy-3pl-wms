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
 * Renders three Combobox fields (no wrapper) so it fits existing filter/form grids.
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
  const cityOptions = useMemo(
    () => toComboboxOptions(listCities(data), value.city || undefined),
    [data, value.city],
  );

  const districtOptions = useMemo(
    () => toComboboxOptions(listDistricts(value.city, data), value.district || undefined),
    [data, value.city, value.district],
  );

  const addressOptions = useMemo(
    () =>
      toComboboxOptions(
        listNeighborhoods(value.city, value.district, data),
        value.addressLine1 || undefined,
      ),
    [data, value.city, value.district, value.addressLine1],
  );

  const districtDisabled = disabled || !value.city;
  const addressDisabled = disabled || !value.city || !value.district;

  return (
    <>
      <Combobox
        label={cityLabel}
        value={value.city}
        onChange={(city) =>
          onChange({
            city,
            district: '',
            addressLine1: '',
          })
        }
        options={cityOptions}
        placeholder={cityPlaceholder}
        disabled={disabled}
        required={cityRequired}
        clearable={!cityRequired}
        emptyMessage={cityOptions.length === 0 ? 'No governorates available' : 'No matches'}
      />
      <Combobox
        label={districtLabel}
        value={value.district}
        onChange={(district) =>
          onChange({
            city: value.city,
            district,
            addressLine1: '',
          })
        }
        options={districtOptions}
        placeholder={districtPlaceholder}
        disabled={districtDisabled}
        required={districtRequired}
        clearable={!districtRequired}
        emptyMessage={
          !value.city
            ? 'Select a governorate first'
            : districtOptions.length === 0
              ? 'No cities/regions available'
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
        disabled={addressDisabled}
        required={addressLine1Required}
        clearable={!addressLine1Required}
        emptyMessage={
          !value.district
            ? 'Select a city/region first'
            : addressOptions.length === 0
              ? 'No towns/neighborhoods available'
              : 'No matches'
        }
      />
    </>
  );
}
