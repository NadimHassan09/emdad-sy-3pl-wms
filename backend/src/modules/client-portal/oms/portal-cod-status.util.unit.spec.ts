import { CodRecordStatus } from '@prisma/client';

import { portalCodStatusFromRecord } from './portal-cod-status.util';

describe('portalCodStatusFromRecord', () => {
  it('maps returned CodRecord status to returned (not pending)', () => {
    expect(portalCodStatusFromRecord(CodRecordStatus.returned)).toBe('returned');
  });

  it('maps other CodRecord statuses to portal labels', () => {
    expect(portalCodStatusFromRecord(CodRecordStatus.pending)).toBe('pending');
    expect(portalCodStatusFromRecord(CodRecordStatus.available)).toBe('collected');
    expect(portalCodStatusFromRecord(CodRecordStatus.paid_out)).toBe('remitted');
  });
});
