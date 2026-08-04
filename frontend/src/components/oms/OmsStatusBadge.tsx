import type { ReactElement } from 'react';

import { StatusBadge } from '@ds';

import {
  omsCommercialStatusBadgeKey,
  omsCommercialStatusLabel,
} from '../../lib/oms-commercial-status';

export function OmsStatusBadge({
  status,
  isArabic,
  className,
}: {
  status: string;
  isArabic?: boolean;
  className?: string;
}): ReactElement {
  return (
    <StatusBadge
      status={omsCommercialStatusBadgeKey(status)}
      isArabic={isArabic}
      className={className}
    >
      {omsCommercialStatusLabel(status, isArabic)}
    </StatusBadge>
  );
}
