import { Module } from '@nestjs/common';

import { CompanyAccessModule } from '../../common/company-access/company-access.module';
import { PdfModule } from '../../pdf/pdf.module';
import { CodController } from './cod.controller';
import { CodRecordsService } from './cod-records.service';

@Module({
  imports: [CompanyAccessModule, PdfModule],
  controllers: [CodController],
  providers: [CodRecordsService],
  exports: [CodRecordsService],
})
export class CodModule {}
