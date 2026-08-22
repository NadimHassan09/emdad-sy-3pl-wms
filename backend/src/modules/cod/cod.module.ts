import { Module } from '@nestjs/common';

import { CompanyAccessModule } from '../../common/company-access/company-access.module';
import { CodController } from './cod.controller';
import { CodRecordsService } from './cod-records.service';

@Module({
  imports: [CompanyAccessModule],
  controllers: [CodController],
  providers: [CodRecordsService],
  exports: [CodRecordsService],
})
export class CodModule {}
