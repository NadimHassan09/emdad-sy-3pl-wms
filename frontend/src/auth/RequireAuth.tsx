import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from './AuthContext';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, booting } = useAuth();
  const location = useLocation();

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">
        Loading…
      </div>
    );
  }

  if (!user) {
    const from = `${location.pathname}${location.search}`;
    return <Navigate to="/login" replace state={{ from: from === '/' ? '/dashboard' : from }} />;
  }

  return <>{children}</>;
}
