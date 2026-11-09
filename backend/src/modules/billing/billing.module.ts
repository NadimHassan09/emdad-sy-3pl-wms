import { Module } from '@nestjs/common';

import { AuditModule } from '../../common/audit/audit.module';
import { PdfModule } from '../../pdf/pdf.module';
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
import { OrderManualChargesService } from './order-manual-charges.service';
import { BillingOnDemandService } from './on-demand/billing-on-demand.service';
import { BillingAutomationService } from './billing-automation.service';
import { FinancialModule } from '../financial/financial.module';
import { CompanyAccessModule } from '../../common/company-access/company-access.module';

@Module({
  imports: [AuditModule, RealtimeModule, PdfModule, FinancialModule, CompanyAccessModule],
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
    OrderManualChargesService,
    BillingOnDemandService,
    BillingAutomationService,
  ],
  exports: [
    BillingAccessService,
    BillingVolumeCapacityService,
    BillingInvoiceCalculationService,
    BillingPlansService,
    BillingCyclesService,
    BillingInvoicesService,
    BillingUsageService,
    OrderManualChargesService,
    BillingOnDemandService,
    BillingAutomationService,
  ],
})
export class BillingModule {}
