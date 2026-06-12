import { useEffect, type ReactElement } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { Alert } from '@ds';

import { roleAccessDeniedCopy } from '../lib/client-billing-restriction';
import { isClientArabic } from '../lib/client-ui-language';

type AccessDeniedState = {
  accessDenied?: string;
};

/** One-time notice after role-based redirect from RequireRouteAccess. */
export function ClientRoleAccessBanner(): ReactElement | null {
  const location = useLocation();
  const navigate = useNavigate();
  const isArabic = isClientArabic();
  const deniedPath = (location.state as AccessDeniedState | null)?.accessDenied;

  useEffect(() => {
    if (!deniedPath) return;
    navigate(location.pathname + location.search, { replace: true, state: {} });
  }, [deniedPath, location.pathname, location.search, navigate]);

  if (!deniedPath) return null;

  const copy = roleAccessDeniedCopy(deniedPath, isArabic);

  return (
    <Alert
      variant={copy.variant}
      title={copy.title}
      description={copy.description}
      className="mb-3"
    />
  );
}
