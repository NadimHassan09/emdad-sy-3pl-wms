export type CompanyFilterOption = { value: string; label: string }

/** Empty value = no client filter (all tenants). */
export function companyFilterComboboxOptions(
  companies: { id: string; name: string }[] | undefined,
  allClientsLabel: string,
): CompanyFilterOption[] {
  return [{ value: '', label: allClientsLabel }, ...(companies ?? []).map((c) => ({ value: c.id, label: c.name }))]
}
