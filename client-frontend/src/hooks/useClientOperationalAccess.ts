import { useQuery } from '@tanstack/react-query';

import { fetchClientBillingAccess } from '../services/clientBillingService';

/** True when client may use operational modules (orders, products, stock). */
export function useClientOperationalAccess() {
  const access = useQuery({
    queryKey: ['client', 'billing', 'access'],
    queryFn: fetchClientBillingAccess,
    staleTime: 60_000,
  });

  const accountStatus = access.data?.accountStatus ?? 'active';

  return {
    operationalAllowed: access.data?.operationalAllowed ?? true,
    accountStatus,
    isLoading: access.isLoading,
    isRestricted: accountStatus === 'restricted' || accountStatus === 'no_plan',
    isExpiring: accountStatus === 'expiring',
  };
}
