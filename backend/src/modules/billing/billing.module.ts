import { Module } from '@nestjs/common';

import {
  BillingAccessService,
  BillingVolumeCapacityService,
} from './billing-access.service';
import { BillingController } from './billing.controller';
import { BillingCycleProcessorService } from './billing-cycle-processor.service';
import { BillingCyclesService } from './billing-cycles.service';
import { BillingInvoicesService } from './billing-invoices.service';
import { BillingPlansService } from './billing-plans.service';

@Module({
  controllers: [BillingController],
  providers: [
    BillingAccessService,
    BillingVolumeCapacityService,
    BillingPlansService,
    BillingCyclesService,
    BillingInvoicesService,
    BillingCycleProcessorService,
  ],
  exports: [BillingAccessService, BillingVolumeCapacityService],
})
export class BillingModule {}
