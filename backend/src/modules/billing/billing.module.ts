import { Module } from '@nestjs/common';

import { AuditModule } from '../../common/audit/audit.module';
import {
  BillingAccessService,
  BillingVolumeCapacityService,
} from './billing-access.service';
import { BillingController } from './billing.controller';
import { BillingCycleProcessorService } from './billing-cycle-processor.service';
import { BillingCyclesService } from './billing-cycles.service';
import { BillingInvoiceCalculationService } from './billing-invoice-calculation.service';
import { BillingInvoicesService } from './billing-invoices.service';
import { BillingPlansService } from './billing-plans.service';
import { BillingUsageProcessorService } from './billing-usage-processor.service';
import { BillingUsageService } from './billing-usage.service';

@Module({
  imports: [AuditModule],
  controllers: [BillingController],
  providers: [
    BillingAccessService,
    BillingVolumeCapacityService,
    BillingPlansService,
    BillingCyclesService,
    BillingInvoicesService,
    BillingInvoiceCalculationService,
    BillingUsageService,
    BillingUsageProcessorService,
    BillingCycleProcessorService,
  ],
  exports: [
    BillingAccessService,
    BillingVolumeCapacityService,
    BillingInvoiceCalculationService,
  ],
})
export class BillingModule {}
