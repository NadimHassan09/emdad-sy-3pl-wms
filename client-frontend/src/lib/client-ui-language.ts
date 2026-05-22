import { useEffect, useState } from 'react';

/** Whether the client portal UI is in Arabic (matches PortalLayout language toggle). */
export function isClientArabic(): boolean {
  if (typeof document === 'undefined') return false;
  return (
    document.documentElement.dir === 'rtl' ||
    window.localStorage.getItem('client-ui-language') === 'AR'
  );
}

/** Re-renders when language changes without a full document reload. */
export function useClientArabic(): boolean {
  const [isArabic, setIsArabic] = useState(isClientArabic);

  useEffect(() => {
    const sync = () => setIsArabic(isClientArabic());
    window.addEventListener('client-ui-language-changed', sync);
    return () => window.removeEventListener('client-ui-language-changed', sync);
  }, []);

  return isArabic;
}
