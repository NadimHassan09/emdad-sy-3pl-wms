import { type ReactNode, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { canAccessClientPath, redirectPathForDeniedRoute } from '../lib/rbac';
import { useAuth } from './AuthContext';

type Props = {
  children: ReactNode;
};

export function RequireRouteAccess({ children }: Props) {
  const { user } = useAuth();
  const { pathname } = useLocation();

  const role = user?.role;
  const allowed = canAccessClientPath(role, pathname);
  const fallback = redirectPathForDeniedRoute(role, pathname);

  useEffect(() => {
    if (user && !allowed) {
      console.warn(`Client role "${role}" cannot access ${pathname}; redirecting to ${fallback}`);
    }
  }, [user, allowed, pathname, fallback, role]);

  if (!user) return null;

  if (!allowed) {
    return (
      <Navigate
        to={fallback}
        replace
        state={{ accessDenied: pathname }}
      />
    );
  }

  return <>{children}</>;
}
