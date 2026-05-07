import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

import type { ClientUser } from '../types/auth';
import * as authService from '../services/authService';
import { clearStoredBearer, getStoredBearer } from '../services/authStorage';
import { setUnauthorizedHandler } from '../services/apiClient';

interface AuthState {
  user: ClientUser | null;
  bootstrapped: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  onSessionInvalid,
}: {
  children: ReactNode;
  onSessionInvalid: () => void;
}): ReactElement {
  const [user, setUser] = useState<ClientUser | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  const clearSession = useCallback(() => {
    clearStoredBearer();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
      onSessionInvalid();
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSession, onSessionInvalid]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hasHint = Boolean(getStoredBearer());
      try {
        const me = await authService.fetchCurrentUser();
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled && hasHint) clearStoredBearer();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setBootstrapped(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const me = await authService.login(email, password);
    setUser(me);
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await authService.fetchCurrentUser();
    setUser(me);
  }, []);

  const value = useMemo(
    () => ({
      user,
      bootstrapped,
      login,
      logout,
      refreshUser,
    }),
    [user, bootstrapped, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
