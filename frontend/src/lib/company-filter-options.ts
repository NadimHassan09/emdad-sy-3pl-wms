import type { ComboboxOption } from '../components/Combobox';

/** Empty value = no client filter (all tenants). */
export function companyFilterComboboxOptions(
  companies: { id: string; name: string }[] | undefined,
  allClientsLabel: string,
): ComboboxOption[] {
  return [{ value: '', label: allClientsLabel }, ...(companies ?? []).map((c) => ({ value: c.id, label: c.name }))];
}
