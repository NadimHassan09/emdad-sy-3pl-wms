import { useCallback, useEffect, useState } from 'react';

/** Bilingual UI message — tuple or object; plain string passes through (business terms). */
export type LocalizedMessage =
  | string
  | readonly [en: string, ar: string]
  | { en: string; ar: string };

export const WMS_UI_LANGUAGE_STORAGE_KEY = 'wms-ui-language';
export const WMS_UI_LANGUAGE_CHANGED_EVENT = 'wms-ui-language-changed';

export type UiLanguage = 'EN' | 'AR';

function readIsArabic(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.localStorage.getItem(WMS_UI_LANGUAGE_STORAGE_KEY) === 'AR' ||
    document.documentElement.dir === 'rtl'
  );
}

function resolveMessage(message: LocalizedMessage, isArabic: boolean): string {
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return isArabic ? message[1] : message[0];
  const obj = message as { en: string; ar: string };
  return isArabic ? obj.ar : obj.en;
}

export type UseWmsTranslationResult = {
  t: (message: LocalizedMessage) => string;
  isArabic: boolean;
  locale: 'ar-SY' | 'en-GB';
  language: UiLanguage;
};

/**
 * Unified admin UI translation hook (I18N-2). No i18next — EN/AR runtime selection only.
 */
export function useWmsTranslation(): UseWmsTranslationResult {
  const [isArabic, setIsArabic] = useState(readIsArabic);

  useEffect(() => {
    const sync = () => setIsArabic(readIsArabic());
    window.addEventListener(WMS_UI_LANGUAGE_CHANGED_EVENT, sync);
    return () => window.removeEventListener(WMS_UI_LANGUAGE_CHANGED_EVENT, sync);
  }, []);

  const t = useCallback(
    (message: LocalizedMessage) => resolveMessage(message, isArabic),
    [isArabic],
  );

  return {
    t,
    isArabic,
    locale: isArabic ? 'ar-SY' : 'en-GB',
    language: isArabic ? 'AR' : 'EN',
  };
}
