/** Whether the client portal UI is in Arabic (matches PortalLayout language toggle). */
export function isClientArabic(): boolean {
  if (typeof document === 'undefined') return false;
  return (
    document.documentElement.dir === 'rtl' ||
    window.localStorage.getItem('client-ui-language') === 'AR'
  );
}
