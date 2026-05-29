import { IsIn, IsOptional } from 'class-validator';

import { ListAuditLogsQueryDto } from './list-audit-logs-query.dto';

export class ExportAuditLogsQueryDto extends ListAuditLogsQueryDto {
  @IsOptional()
  @IsIn(['csv', 'json'])
  format: 'csv' | 'json' = 'csv';
}
