import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { AuthPrincipal } from '../../../common/auth/current-user.types';
import { getReportDefinition } from './report-registry.config';

export function assertReportAccess(user: AuthPrincipal, reportId: string): void {
  const def = getReportDefinition(reportId);
  if (!def) {
    throw new NotFoundException(`Unknown report: ${reportId}`);
  }
  if (!def.allowedRoles.includes(user.role as UserRole)) {
    throw new ForbiddenException(
      `Your role (${user.role}) is not permitted to access the "${def.title}" report.`,
    );
  }
}

export function canAccessReport(role: UserRole, reportId: string): boolean {
  const def = getReportDefinition(reportId);
  if (!def) return false;
  return def.allowedRoles.includes(role);
}
