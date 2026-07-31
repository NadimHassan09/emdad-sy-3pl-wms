import { useCallback, useEffect, useState } from 'react';

export type UiTheme = 'light' | 'dark';
export type UiThemePreference = UiTheme | 'system';

export type UseUiThemeOptions = {
  /** localStorage key, e.g. `client-ui-theme` or `admin-ui-theme`. */
  storageKey: string;
  /**
   * Extra root selectors that should also receive the `.dark` class.
   * Defaults to Client Portal + Admin roots; missing nodes are skipped.
   */
  extraRootSelectors?: string[];
};

const DEFAULT_EXTRA_ROOTS = ['#client-portal-root', '#admin-root'];

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function readStoredPreference(storageKey: string): UiThemePreference {
  if (typeof window === 'undefined') return 'system';
  const stored = window.localStorage.getItem(storageKey);
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
}

function resolveTheme(preference: UiThemePreference): UiTheme {
  if (preference === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return preference;
}

/**
 * Applies the resolved theme to the document root (and any additional root
 * elements, e.g. `#client-portal-root`) by toggling the `.dark` class that
 * `tokens.css` keys its dark-theme overrides off of.
 */
export function applyUiTheme(resolved: UiTheme, extraRootSelectors: string[] = []): void {
  const roots = [document.documentElement, ...extraRootSelectors
    .map((sel) => document.querySelector(sel))
    .filter((el): el is HTMLElement => el !== null)];

  for (const root of roots) {
    root.classList.toggle('dark', resolved === 'dark');
  }
}

/**
 * Theme state (light / dark / system) persisted to localStorage, with a
 * `data-theme`-free strategy — `.dark` class toggling instead, matching the
 * `tokens.css` `.dark` selector convention.
 */
export function useUiTheme({
  storageKey,
  extraRootSelectors = DEFAULT_EXTRA_ROOTS,
}: UseUiThemeOptions) {
  const [preference, setPreferenceState] = useState<UiThemePreference>(() =>
    readStoredPreference(storageKey),
  );
  const [resolved, setResolved] = useState<UiTheme>(() => resolveTheme(readStoredPreference(storageKey)));
  const extraRootsKey = extraRootSelectors.join('\0');

  useEffect(() => {
    const next = resolveTheme(preference);
    setResolved(next);
    applyUiTheme(next, extraRootSelectors);
    window.localStorage.setItem(storageKey, preference);
  }, [preference, storageKey, extraRootsKey, extraRootSelectors]);

  // React to OS-level theme changes while preference === 'system'.
  useEffect(() => {
    if (preference !== 'system' || typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const next = systemPrefersDark() ? 'dark' : 'light';
      setResolved(next);
      applyUiTheme(next, extraRootSelectors);
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [preference, extraRootsKey, extraRootSelectors]);

  const setPreference = useCallback((next: UiThemePreference) => {
    setPreferenceState(next);
  }, []);

  const toggle = useCallback(() => {
    setPreferenceState((current) => {
      const currentResolved = resolveTheme(current);
      return currentResolved === 'dark' ? 'light' : 'dark';
    });
  }, []);

  return {
    /** 'light' | 'dark' | 'system' — the user's stored choice. */
    preference,
    /** 'light' | 'dark' — the actual applied theme. */
    theme: resolved,
    isDark: resolved === 'dark',
    setPreference,
    toggle,
  };
}
