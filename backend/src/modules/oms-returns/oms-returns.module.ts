import { Module, forwardRef } from '@nestjs/common';

import { CompanyAccessModule } from '../../common/company-access/company-access.module';
import { CodModule } from '../cod/cod.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ReturnsModule } from '../returns/returns.module';
import { ShippingModule } from '../shipping/shipping.module';
import { OmsReturnsController } from './oms-returns.controller';
import { OmsReturnsService } from './oms-returns.service';

@Module({
  imports: [
    CompanyAccessModule,
    CodModule,
    InventoryModule,
    forwardRef(() => ReturnsModule),
    forwardRef(() => ShippingModule),
  ],
  controllers: [OmsReturnsController],
  providers: [OmsReturnsService],
  exports: [OmsReturnsService],
})
export class OmsReturnsModule {}
