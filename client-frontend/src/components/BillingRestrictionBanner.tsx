import type { ReactElement } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { Alert } from '@ds';

import { useAuth } from '../auth/AuthContext';
import { useClientOperationalAccess } from '../hooks/useClientOperationalAccess';
import { isClientArabic } from '../lib/client-ui-language';
import { isClientAdmin } from '../lib/rbac';

type Props = {
  className?: string;
};

export function BillingRestrictionBanner({ className = 'mb-3' }: Props): ReactElement | null {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const isArabic = isClientArabic();
  const { isLoading, restriction, operationalAllowed } = useClientOperationalAccess(isArabic);

  if (isLoading || !restriction.showBanner) return null;
  if (pathname.startsWith('/billing') && operationalAllowed) return null;

  const showBillingLink = isClientAdmin(user?.role);

  return (
    <Alert
      variant={restriction.variant}
      title={restriction.title}
      description={
        <>
          {restriction.description}
          {showBillingLink ? (
            <>
              {' '}
              <Link to="/billing" className="font-medium underline">
                {isArabic ? 'عرض الفوترة' : 'View billing'}
              </Link>
            </>
          ) : null}
        </>
      }
      className={className}
    />
  );
}
