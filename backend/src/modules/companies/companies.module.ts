import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
