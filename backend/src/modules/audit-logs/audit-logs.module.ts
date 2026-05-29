import { Module } from '@nestjs/common';

import { AuditModule } from '../../common/audit/audit.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuditLogPolicyConfig } from './audit-log-policy.config';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [AuditLogsController],
  providers: [AuditLogsService, AuditLogPolicyConfig],
})
export class AuditLogsModule {}
