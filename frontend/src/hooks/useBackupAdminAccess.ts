import { useAuth } from '../auth/AuthContext';

export function useBackupAdminAccess() {
  const { user } = useAuth();
  const role = user?.role;
  const canRead = role === 'super_admin' || role === 'wh_manager';
  const canMutate = role === 'super_admin';

  return {
    canRead,
    canMutate,
    isSuperAdmin: canMutate,
  };
}
