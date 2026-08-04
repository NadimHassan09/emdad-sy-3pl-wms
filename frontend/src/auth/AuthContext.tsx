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
  getAccessToken,
  setAccessToken,
  setRememberedAccount,
} from './authStorage';

export type AuthUser = MeResponse & { fullName?: string };
const AUTH_FULL_NAME_KEY = 'auth.fullName';
const PERSIST_KEY = 'wms.persist_session';

function shouldPersistSession(): boolean {
  try {
    return window.localStorage.getItem(PERSIST_KEY) === '1';
  } catch {
    return false;
  }
}

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
        // After logout there is no refresh cookie and no bearer — skip the 401 noise on /login.
        if (onLoginPage && !shouldPersistSession()) {
          setUser(null);
          return;
        }
        try {
          const refreshed = await AuthApi.refreshSession();
          setAccessToken(refreshed.access_token, shouldPersistSession());
        } catch {
          setUser(null);
          return;
        }
      }
      setUser(await loadMeUser());
    } catch {
      try {
        const refreshed = await AuthApi.refreshSession();
        setAccessToken(refreshed.access_token, shouldPersistSession());
        setUser(await loadMeUser());
      } catch {
        clearAccessToken();
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
      if (
        detail?.type === 'forced_logout' ||
        detail?.type === 'expired' ||
        detail?.type === 'logout'
      ) {
        void (async () => {
          try {
            await AuthApi.logout();
          } catch {
            /* ignore */
          } finally {
            if (typeof window !== 'undefined') {
              window.localStorage.removeItem(AUTH_FULL_NAME_KEY);
            }
            beginLogoutFlow();
            clearAccessToken();
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
  }, []);

  const login = useCallback(
    async (email: string, password: string, options?: { persistSession?: boolean }) => {
      const persist = Boolean(options?.persistSession);
      const res = await AuthApi.login(email, password, persist ? { rememberMe: true } : undefined);
      setAccessToken(res.access_token, persist);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(AUTH_FULL_NAME_KEY, res.user.fullName);
      }
      if (persist) {
        setRememberedAccount({
          email: res.user.email || email,
          displayName: res.user.fullName || res.user.email || email,
        });
      }
      const authUser = await loadMeUser();
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
    if (!getAccessToken()) {
      if (!shouldPersistSession()) {
        throw new Error('No session to resume');
      }
      const refreshed = await AuthApi.refreshSession();
      setAccessToken(refreshed.access_token, true);
    }
    try {
      const authUser = await loadMeUser();
      setUser(authUser);
      return authUser;
    } catch {
      const refreshed = await AuthApi.refreshSession();
      setAccessToken(refreshed.access_token, true);
      const authUser = await loadMeUser();
      setUser(authUser);
      return authUser;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await AuthApi.logout();
    } finally {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(AUTH_FULL_NAME_KEY);
      }
      beginLogoutFlow();
      clearAccessToken();
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
