import { useAuth } from '../auth/AuthContext';

const DEV_COMPANY_ID = (import.meta.env.VITE_MOCK_COMPANY_ID as string | undefined)?.trim() || '';

/**
 * Tenant id for operational list APIs (`companyId` query / write scope).
 * Prefers session tenant from `/auth/me`, then dev `VITE_MOCK_COMPANY_ID`.
 */
export function useTenantCompanyId(): string {
  const { user } = useAuth();
  return user?.tenantCompanyId?.trim() || DEV_COMPANY_ID;
}
