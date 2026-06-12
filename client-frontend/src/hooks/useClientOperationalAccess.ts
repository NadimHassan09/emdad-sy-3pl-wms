import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { buildBillingRestrictionCopy } from '../lib/client-billing-restriction';
import { fetchClientBillingAccess } from '../services/clientBillingService';

/** True when client may use operational modules (orders, products, stock). */
export function useClientOperationalAccess(isArabic = false) {
  const access = useQuery({
    queryKey: ['client', 'billing', 'access'],
    queryFn: fetchClientBillingAccess,
    staleTime: 60_000,
  });

  const accountStatus = access.data?.accountStatus ?? 'active';
  const daysRemaining = access.data?.daysRemaining ?? null;

  const restriction = useMemo(
    () => buildBillingRestrictionCopy(accountStatus, daysRemaining, isArabic),
    [accountStatus, daysRemaining, isArabic],
  );

  return {
    operationalAllowed: access.data?.operationalAllowed ?? true,
    accountStatus,
    daysRemaining,
    isLoading: access.isLoading,
    isRestricted: accountStatus === 'restricted' || accountStatus === 'no_plan',
    isExpiring: accountStatus === 'expiring',
    restriction,
    actionBlockedReason: restriction.actionBlockedReason,
  };
}
