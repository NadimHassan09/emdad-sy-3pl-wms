import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { AuthApi, type MeResponse } from '../api/auth';
import {
  clearAccessToken,
  beginLogoutFlow,
  canContinueSession,
  clearContinueSession,
  clearRememberedAccount,
  getAccessToken,
  getRememberedAccount,
  isPersistSessionEnabled,
  markContinueSessionAvailable,
  setAccessToken,
  setRememberedAccount,
} from './authStorage';

export type AuthUser = MeResponse & { fullName?: string };
const AUTH_FULL_NAME_KEY = 'auth.fullName';

type AuthContextValue = {
  user: AuthUser | null;
  booting: boolean;
  login: (
    email: string,
    password: string,
    options?: { persistSession?: boolean },
  ) => Promise<AuthUser>;
  /** Resume a remembered/persisted session without password (refresh cookie or bearer). */
  resumeSession: () => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadMeUser(): Promise<AuthUser> {
  const me = await AuthApi.me();
  const cachedFullName =
    typeof window !== 'undefined' ? window.localStorage.getItem(AUTH_FULL_NAME_KEY) : null;
  const resolvedFullName = me.fullName?.trim() || cachedFullName?.trim() || undefined;
  return { ...me, fullName: resolvedFullName };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [booting, setBooting] = useState(true);

  const refresh = useCallback(async () => {
    try {
      if (!getAccessToken()) {
        const onLoginPage =
          typeof window !== 'undefined' && window.location.pathname.startsWith('/login');
        // After logout there is no refresh cookie — skip the 401 noise on /login
        // unless remember-me (or a remembered account chip) suggests a cookie may exist.
        if (onLoginPage && !isPersistSessionEnabled() && !getRememberedAccount()) {
          setUser(null);
          return;
        }
        try {
          const refreshed = await AuthApi.refreshSession();
          const persist = isPersistSessionEnabled();
          setAccessToken(refreshed.access_token, persist);
          if (persist) markContinueSessionAvailable();
        } catch {
          // No live refresh cookie — do not offer Continue.
          clearContinueSession();
          setUser(null);
          return;
        }
      }
      setUser(await loadMeUser());
      } catch {
        try {
          const refreshed = await AuthApi.refreshSession();
          const persist = isPersistSessionEnabled();
          setAccessToken(refreshed.access_token, persist);
          if (persist) markContinueSessionAvailable();
          setUser(await loadMeUser());
        } catch {
          clearContinueSession();
          clearAccessToken({ keepPersist: isPersistSessionEnabled() });
          setUser(null);
        }
      } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onSessionChanged = (ev: Event) => {
      const detail = (ev as CustomEvent<{ type?: string; reason?: string }>).detail;
      if (detail?.type === 'revalidate') {
        void refresh();
        return;
      }
      if (
        detail?.type === 'forced_logout' ||
        detail?.type === 'expired' ||
        detail?.type === 'logout'
      ) {
        void (async () => {
          try {
            // Hard logout — refresh cookie is no longer valid for Continue.
            await AuthApi.logout({ soft: false });
          } catch {
            /* ignore */
          } finally {
            if (typeof window !== 'undefined') {
              window.localStorage.removeItem(AUTH_FULL_NAME_KEY);
            }
            beginLogoutFlow();
            clearContinueSession();
            clearAccessToken();
            // Keep remembered email for prefill, but Continue must not be offered
            // without a live refresh cookie (forced/expired already wiped it).
            if (detail?.type === 'forced_logout' || detail?.type === 'expired') {
              clearRememberedAccount();
            }
            setUser(null);
            if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
              window.location.assign('/login');
            }
          }
        })();
      }
    };
    window.addEventListener('wms:session-changed', onSessionChanged);
    return () => window.removeEventListener('wms:session-changed', onSessionChanged);
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string, options?: { persistSession?: boolean }) => {
      const persist = Boolean(options?.persistSession);
      const res = await AuthApi.login(email, password, persist ? { rememberMe: true } : undefined);
      setAccessToken(res.access_token, persist);
      if (persist) markContinueSessionAvailable();
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(AUTH_FULL_NAME_KEY, res.user.fullName);
      }
      const authUser = await loadMeUser();
      if (persist) {
        const avatarPath = authUser.avatarUrl?.trim();
        setRememberedAccount({
          email: res.user.email || email,
          displayName: res.user.fullName || res.user.email || email,
          avatarUrl: avatarPath
            ? `/api/client/media/${avatarPath.replace(/^\/media\//, '').replace(/^\/+/, '')}`
            : null,
        });
      }
      const withName: AuthUser = {
        ...authUser,
        fullName: authUser.fullName?.trim() || res.user.fullName.trim() || undefined,
      };
      setUser(withName);
      return withName;
    },
    [],
  );

  const resumeSession = useCallback(async () => {
    // Continue always uses the refresh cookie — ignore any leftover access JWT.
    const refreshed = await AuthApi.refreshSession();
    const persist = isPersistSessionEnabled() || Boolean(getRememberedAccount());
    setAccessToken(refreshed.access_token, persist);
    if (persist) markContinueSessionAvailable();
    const authUser = await loadMeUser();
    setUser(authUser);
    return authUser;
  }, []);

  const logout = useCallback(async () => {
    // Soft logout keeps the refresh cookie so Continue can restore the session.
    const soft = isPersistSessionEnabled() || canContinueSession();
    try {
      await AuthApi.logout({ soft });
    } finally {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(AUTH_FULL_NAME_KEY);
      }
      beginLogoutFlow();
      // Soft (remember-me): keep persist flag + refresh cookie for Continue.
      clearAccessToken({ keepPersist: soft });
      if (soft) {
        markContinueSessionAvailable();
      } else {
        clearContinueSession();
      }
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      booting,
      login,
      resumeSession,
      logout,
      refresh,
    }),
    [user, booting, login, resumeSession, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
