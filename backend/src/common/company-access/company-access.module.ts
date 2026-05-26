import { Global, Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { CompanyAccessService } from './company-access.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [CompanyAccessService],
  exports: [CompanyAccessService],
})
export class CompanyAccessModule {}
