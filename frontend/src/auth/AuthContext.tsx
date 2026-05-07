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
import { getAccessToken, setAccessToken } from './authStorage';

export type AuthUser = MeResponse & { fullName?: string };
const AUTH_FULL_NAME_KEY = 'auth.fullName';

type AuthContextValue = {
  user: AuthUser | null;
  booting: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [booting, setBooting] = useState(true);

  const refresh = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      setBooting(false);
      return;
    }
    try {
      const me = await AuthApi.me();
      const cachedFullName =
        typeof window !== 'undefined' ? window.localStorage.getItem(AUTH_FULL_NAME_KEY) : null;
      const resolvedFullName = me.fullName?.trim() || cachedFullName?.trim() || undefined;
      setUser({ ...me, fullName: resolvedFullName });
    } catch {
      setAccessToken(null);
      setUser(null);
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await AuthApi.login(email, password);
    setAccessToken(res.access_token);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(AUTH_FULL_NAME_KEY, res.user.fullName);
    }
    const me = await AuthApi.me();
    const resolvedFullName = me.fullName?.trim() || res.user.fullName.trim() || undefined;
    setUser({ ...me, fullName: resolvedFullName });
  }, []);

  const logout = useCallback(async () => {
    try {
      await AuthApi.logout();
    } finally {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(AUTH_FULL_NAME_KEY);
      }
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      booting,
      login,
      logout,
      refresh,
    }),
    [user, booting, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
