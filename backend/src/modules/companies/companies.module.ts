import { Module } from '@nestjs/common';

import { AuditModule } from '../../common/audit/audit.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CustomerLifecycleService } from './customer-lifecycle.service';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule],
  controllers: [CompaniesController],
  providers: [CompaniesService, CustomerLifecycleService],
  exports: [CompaniesService, CustomerLifecycleService],
})
export class CompaniesModule {}
