import type { ReactElement, ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from './AuthContext';

export function RequireAuth({ children }: { children: ReactNode }): ReactElement {
  const { user, bootstrapped } = useAuth();
  const location = useLocation();

  if (!bootstrapped) {
    return (
      <div className="page page--centered">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
