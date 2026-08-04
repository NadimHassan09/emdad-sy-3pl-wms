import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { setPostLoginReturnTo } from './authStorage';
import { useAuth } from './AuthContext';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, booting } = useAuth();
  const location = useLocation();

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-page text-sm text-text-body">
        Loading…
      </div>
    );
  }

  if (!user) {
    const from = `${location.pathname}${location.search}`;
    setPostLoginReturnTo(from);
    return <Navigate to="/login" replace state={{ from }} />;
  }

  return <>{children}</>;
}
