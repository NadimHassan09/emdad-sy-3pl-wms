import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * Language + theme + text direction, shared by both portals.
 * Storage keys/events match the existing Emdad apps so a user's saved choice
 * carries over (`wms-ui-language`, `admin-ui-theme`, `client-ui-theme`).
 * This file is intentionally self-contained (no imports from legacy code).
 */

export type UiLanguage = 'EN' | 'AR';
export type UiTheme = 'light' | 'dark';
export type UiThemePreference = UiTheme | 'system';
export type Direction = 'ltr' | 'rtl';

/** Bilingual UI message: `[en, ar]` tuple / `{en, ar}`; plain string = business term, same in both. */
export type LocalizedMessage =
  | string
  | readonly [en: string, ar: string]
  | { en: string; ar: string };

export const UI_LANGUAGE_STORAGE_KEY = 'wms-ui-language';
export const UI_LANGUAGE_CHANGED_EVENT = 'wms-ui-language-changed';

export function resolveMessage(message: LocalizedMessage, isArabic: boolean): string {
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return isArabic ? message[1] : message[0];
  const obj = message as { en: string; ar: string };
  return isArabic ? obj.ar : obj.en;
}

function readLanguage(): UiLanguage {
  if (typeof window === 'undefined') return 'EN';
  try {
    const stored = window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY);
    if (stored === 'AR' || stored === 'EN') return stored;
  } catch {
    /* storage blocked */
  }
  return 'EN';
}

function readThemePreference(key: string): UiThemePreference {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = window.localStorage.getItem(key);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    /* storage blocked */
  }
  return 'system';
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyToDocument(language: UiLanguage, theme: UiTheme) {
  const root = document.documentElement;
  const dir: Direction = language === 'AR' ? 'rtl' : 'ltr';
  root.setAttribute('lang', language === 'AR' ? 'ar' : 'en');
  root.setAttribute('dir', dir);
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}

export type UiPreferences = {
  language: UiLanguage;
  isArabic: boolean;
  dir: Direction;
  /** `ar-SY` or `en-GB` (+ Latin digits so order numbers/quantities stay scannable). */
  locale: string;
  setLanguage: (l: UiLanguage) => void;
  toggleLanguage: () => void;
  themePreference: UiThemePreference;
  theme: UiTheme;
  setThemePreference: (t: UiThemePreference) => void;
  toggleTheme: () => void;
  /** Translate a `LocalizedMessage` using the active language. */
  t: (message: LocalizedMessage) => string;
};

const Ctx = createContext<UiPreferences | null>(null);

export function UiPreferencesProvider({
  themeStorageKey,
  children,
}: {
  /** `admin-ui-theme` for the admin portal, `client-ui-theme` for the client portal. */
  themeStorageKey: string;
  children: ReactNode;
}) {
  const [language, setLanguageState] = useState<UiLanguage>(readLanguage);
  const [themePreference, setThemePrefState] = useState<UiThemePreference>(() => readThemePreference(themeStorageKey));
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  const theme: UiTheme = themePreference === 'system' ? (systemDark ? 'dark' : 'light') : themePreference;

  useLayoutEffect(() => {
    applyToDocument(language, theme);
  }, [language, theme]);

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Keep tabs / other listeners in sync.
  useEffect(() => {
    const sync = () => setLanguageState(readLanguage());
    window.addEventListener(UI_LANGUAGE_CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(UI_LANGUAGE_CHANGED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setLanguage = useCallback((l: UiLanguage) => {
    try {
      window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
    setLanguageState(l);
    window.dispatchEvent(new Event(UI_LANGUAGE_CHANGED_EVENT));
  }, []);

  const setThemePreference = useCallback(
    (t: UiThemePreference) => {
      try {
        window.localStorage.setItem(themeStorageKey, t);
      } catch {
        /* ignore */
      }
      setThemePrefState(t);
    },
    [themeStorageKey],
  );

  const value = useMemo<UiPreferences>(() => {
    const isArabic = language === 'AR';
    return {
      language,
      isArabic,
      dir: isArabic ? 'rtl' : 'ltr',
      locale: isArabic ? 'ar-SY-u-nu-latn' : 'en-GB',
      setLanguage,
      toggleLanguage: () => setLanguage(isArabic ? 'EN' : 'AR'),
      themePreference,
      theme,
      setThemePreference,
      toggleTheme: () => setThemePreference(theme === 'dark' ? 'light' : 'dark'),
      t: (m) => resolveMessage(m, isArabic),
    };
  }, [language, theme, themePreference, setLanguage, setThemePreference]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUiPreferences(): UiPreferences {
  const v = useContext(Ctx);
  if (!v) throw new Error('useUiPreferences must be used inside <UiPreferencesProvider>');
  return v;
}

/** Shorthand used by pages: `const { t, isArabic } = useT()`. */
export const useT = useUiPreferences;
