import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { AuthPrincipal } from '../../../common/auth/current-user.types';
import { assertReportAccess, canAccessReport } from './report-permissions.util';

const manager: AuthPrincipal = {
  id: 'u1',
  role: UserRole.wh_manager,
  companyId: null,
  tenantScope: 'all',
  authorizedCompanyIds: [],
};

const operator: AuthPrincipal = {
  id: 'u2',
  role: UserRole.wh_operator,
  companyId: null,
  tenantScope: 'all',
  authorizedCompanyIds: [],
};

describe('report-permissions.util', () => {
  it('allows managers to access inventory report', () => {
    expect(() => assertReportAccess(manager, 'inventory')).not.toThrow();
    expect(canAccessReport(UserRole.wh_manager, 'inventory')).toBe(true);
  });

  it('denies operators', () => {
    expect(() => assertReportAccess(operator, 'inventory')).toThrow(ForbiddenException);
    expect(canAccessReport(UserRole.wh_operator, 'inventory')).toBe(false);
  });
});
