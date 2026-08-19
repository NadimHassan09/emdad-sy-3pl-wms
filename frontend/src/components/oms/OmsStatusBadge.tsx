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
  needsInformation,
}: {
  status: string;
  isArabic?: boolean;
  className?: string;
  needsInformation?: boolean;
}): ReactElement {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {needsInformation ? (
        <StatusBadge status="failed delivery" isArabic={isArabic}>
          {isArabic ? 'طلب غير مكتمل' : 'Incomplete Order'}
        </StatusBadge>
      ) : null}
      <StatusBadge
        status={omsCommercialStatusBadgeKey(status)}
        isArabic={isArabic}
        className={className}
      >
        {omsCommercialStatusLabel(status, isArabic)}
      </StatusBadge>
    </span>
  );
}
