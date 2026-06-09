import { Module } from '@nestjs/common';

import { AuditModule } from '../../common/audit/audit.module';
import { RealtimeModule } from '../realtime/realtime.module';
import {
  BillingAccessService,
  BillingVolumeCapacityService,
} from './billing-access.service';
import { BillingAuditService } from './billing-audit.service';
import { BillingController } from './billing.controller';
import { BillingDashboardService } from './billing-dashboard.service';
import { BillingInvoiceOverdueProcessorService } from './billing-invoice-overdue-processor.service';
import { BillingPreviewService } from './billing-preview.service';
import { BillingCycleProcessorService } from './billing-cycle-processor.service';
import { BillingExpiryReminderService } from './billing-expiry-reminder.service';
import { BillingNotificationsService } from './billing-notifications.service';
import { BillingCyclesService } from './billing-cycles.service';
import { BillingInvoiceCalculationService } from './billing-invoice-calculation.service';
import { BillingInvoicesService } from './billing-invoices.service';
import { BillingPlansService } from './billing-plans.service';
import { BillingUsageProcessorService } from './billing-usage-processor.service';
import { BillingUsageService } from './billing-usage.service';

@Module({
  imports: [AuditModule, RealtimeModule],
  controllers: [BillingController],
  providers: [
    BillingAuditService,
    BillingAccessService,
    BillingVolumeCapacityService,
    BillingPreviewService,
    BillingInvoiceOverdueProcessorService,
    BillingPlansService,
    BillingCyclesService,
    BillingInvoicesService,
    BillingInvoiceCalculationService,
    BillingUsageService,
    BillingUsageProcessorService,
    BillingCycleProcessorService,
    BillingDashboardService,
    BillingNotificationsService,
    BillingExpiryReminderService,
  ],
  exports: [
    BillingAccessService,
    BillingVolumeCapacityService,
    BillingInvoiceCalculationService,
    BillingPlansService,
    BillingCyclesService,
    BillingInvoicesService,
    BillingUsageService,
  ],
})
export class BillingModule {}
