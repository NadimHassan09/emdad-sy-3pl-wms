/** Font Awesome icon class per warehouse task type (details card avatar). */
export function taskTypeIconClass(taskType: string): string {
  const icons: Record<string, string> = {
    receiving: 'fa-solid fa-truck-ramp-box',
    qc: 'fa-solid fa-clipboard-check',
    putaway: 'fa-solid fa-arrow-down-to-bracket',
    putaway_quarantine: 'fa-solid fa-triangle-exclamation',
    pick: 'fa-solid fa-cart-flatbed',
    pack: 'fa-solid fa-box-open',
    dispatch: 'fa-solid fa-truck-fast',
    routing: 'fa-solid fa-route',
  };
  return icons[taskType] ?? 'fa-solid fa-clipboard-list';
}
