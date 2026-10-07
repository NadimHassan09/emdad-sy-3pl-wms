import { useEffect } from 'react';

/**
 * Sets document.title for the active Client Portal page.
 */
export function usePageTitle(title: string, isArabic = false): void {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · ${isArabic ? 'بوابة العميل' : 'Client Portal'}`;
    return () => {
      document.title = previous;
    };
  }, [title, isArabic]);
}
