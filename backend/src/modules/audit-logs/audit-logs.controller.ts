import { Controller, Get, Header, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';

import { AuthGroup } from '../../common/auth/auth-groups';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { Roles } from '../../common/auth/roles.decorator';
import { InternalAdminGuard } from '../../common/auth/internal-admin.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { ParseUuidLoosePipe } from '../../common/pipes/parse-uuid-loose.pipe';
import { AuditLogsService } from './audit-logs.service';
import { ExportAuditLogsQueryDto } from './dto/export-audit-logs-query.dto';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

/**
 * Operational audit trail — ADMIN only.
 *
 * `GET /api/audit-logs/policy` — retention/query/export limits (read-only).
 * `GET /api/audit-logs/export` — capped CSV/JSON export (requires date range).
 * `GET /api/audit-logs/archival-candidates` — partition archival prep (super_admin).
 * `GET /api/audit-logs` — paginated list with filters/search.
 * `GET /api/audit-logs/:id` — full event detail including redacted state snapshots.
 */
@Controller('audit-logs')
@UseGuards(RolesGuard)
@Roles(AuthGroup.ADMIN)
export class AuditLogsController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Get('policy')
  getPolicy() {
    return this.auditLogs.getPolicy();
  }

  @Get('export')
  @UseGuards(InternalAdminGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  async export(
    @CurrentUser() user: AuthPrincipal,
    @Query() query: ExportAuditLogsQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auditLogs.export(user, query);
    res.setHeader(
      'Content-Type',
      result.format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('X-Export-Row-Count', String(result.rowCount));
    res.setHeader('X-Export-Truncated', result.truncated ? 'true' : 'false');
    return result.body;
  }

  @Get('archival-candidates')
  getArchivalCandidates(@CurrentUser() user: AuthPrincipal) {
    return this.auditLogs.getArchivalCandidates(user);
  }

  @Get()
  list(@CurrentUser() user: AuthPrincipal, @Query() query: ListAuditLogsQueryDto) {
    return this.auditLogs.list(user, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.auditLogs.findById(user, id);
  }
}
