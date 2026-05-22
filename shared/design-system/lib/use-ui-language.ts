import { useCallback, useEffect, useState } from 'react';

export type UiLanguage = 'EN' | 'AR';

export type UseUiLanguageOptions = {
  /** localStorage key, e.g. `wms-ui-language` or `client-ui-language`. */
  storageKey: string;
  /** Dispatched after language is applied — pages may listen to re-read labels. */
  eventName: string;
  /** Minimum overlay duration so the switch feels intentional (ms). */
  minLoadingMs?: number;
};

function readStored(storageKey: string): UiLanguage {
  if (typeof window === 'undefined') return 'EN';
  return window.localStorage.getItem(storageKey) === 'AR' ? 'AR' : 'EN';
}

export function applyUiLanguage(
  next: UiLanguage,
  storageKey: string,
  eventName: string,
): void {
  const isArabic = next === 'AR';
  document.documentElement.dir = isArabic ? 'rtl' : 'ltr';
  document.documentElement.lang = isArabic ? 'ar' : 'en';
  window.localStorage.setItem(storageKey, next);
  window.dispatchEvent(new CustomEvent(eventName, { detail: { language: next } }));
}

/**
 * Language state for EN/AR UI labels (no full page reload).
 * Shows a loading phase while the app remounts route content via `key={language}`.
 */
export function useUiLanguage({
  storageKey,
  eventName,
  minLoadingMs = 420,
}: UseUiLanguageOptions) {
  const [language, setLanguageState] = useState<UiLanguage>(() => readStored(storageKey));
  const [isSwitching, setIsSwitching] = useState(false);

  const isArabic = language === 'AR';

  useEffect(() => {
    applyUiLanguage(language, storageKey, eventName);
  }, [language, storageKey, eventName]);

  const setLanguage = useCallback(
    async (next: UiLanguage) => {
      if (next === language || isSwitching) return;

      setIsSwitching(true);
      const started = Date.now();

      // Language packs are client-side today; brief delay mirrors a fetch without blocking the UI thread.
      await new Promise<void>((resolve) => window.setTimeout(resolve, 80));

      applyUiLanguage(next, storageKey, eventName);
      setLanguageState(next);

      const elapsed = Date.now() - started;
      if (elapsed < minLoadingMs) {
        await new Promise<void>((resolve) =>
          window.setTimeout(resolve, minLoadingMs - elapsed),
        );
      }

      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );

      setIsSwitching(false);
    },
    [language, isSwitching, storageKey, eventName, minLoadingMs],
  );

  return { language, setLanguage, isArabic, isSwitching };
}
