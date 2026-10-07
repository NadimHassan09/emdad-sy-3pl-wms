import { Navigate } from 'react-router';

import { defaultHomePath } from '../lib/rbac';
import { useAuth } from './AuthContext';

/** Sends authenticated users to the landing page for their role. */
export function RoleHomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={defaultHomePath(user?.role)} replace />;
}
