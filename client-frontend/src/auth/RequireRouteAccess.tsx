import { type ReactNode, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { canAccessClientPath, defaultClientHomePath } from '../lib/rbac';
import { useAuth } from './AuthContext';

type Props = {
  children: ReactNode;
};

export function RequireRouteAccess({ children }: Props) {
  const { user } = useAuth();
  const { pathname } = useLocation();

  const role = user?.role;
  const allowed = canAccessClientPath(role, pathname);
  const home = defaultClientHomePath();

  useEffect(() => {
    if (user && !allowed) {
      console.warn(`Client role "${role}" cannot access ${pathname}; redirecting to ${home}`);
    }
  }, [user, allowed, pathname, home, role]);

  if (!user) return null;

  if (!allowed) {
    return <Navigate to={home} replace />;
  }

  return <>{children}</>;
}
