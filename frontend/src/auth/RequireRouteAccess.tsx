import { type ReactNode, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { canAccessPath, defaultHomePath } from '../lib/rbac';
import { useAuth } from './AuthContext';

type Props = {
  children: ReactNode;
};

/** Redirects users away from routes their role cannot access. */
export function RequireRouteAccess({ children }: Props) {
  const { user } = useAuth();
  const { pathname } = useLocation();

  const role = user?.role;
  const allowed = canAccessPath(role, pathname);
  const home = defaultHomePath(role);

  useEffect(() => {
    if (user && !allowed) {
      // eslint-disable-next-line no-console -- dev aid for misconfigured deep links
      console.warn(`Role "${role}" cannot access ${pathname}; redirecting to ${home}`);
    }
  }, [user, allowed, pathname, home, role]);

  if (!user) return null;

  if (!allowed) {
    return <Navigate to={home} replace />;
  }

  return <>{children}</>;
}
