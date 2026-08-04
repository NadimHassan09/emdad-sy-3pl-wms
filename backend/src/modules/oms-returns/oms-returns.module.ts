import { Module, forwardRef } from '@nestjs/common';

import { CompanyAccessModule } from '../../common/company-access/company-access.module';
import { CodModule } from '../cod/cod.module';
import { ReturnsModule } from '../returns/returns.module';
import { OmsReturnsController } from './oms-returns.controller';
import { OmsReturnsService } from './oms-returns.service';

@Module({
  imports: [
    CompanyAccessModule,
    CodModule,
    forwardRef(() => ReturnsModule),
  ],
  controllers: [OmsReturnsController],
  providers: [OmsReturnsService],
  exports: [OmsReturnsService],
})
export class OmsReturnsModule {}
