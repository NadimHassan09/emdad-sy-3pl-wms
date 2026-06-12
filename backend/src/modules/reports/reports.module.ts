import { Module } from '@nestjs/common';

import { CompaniesModule } from '../companies/companies.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { InboundModule } from '../inbound/inbound.module';
import { InventoryModule } from '../inventory/inventory.module';
import { OutboundModule } from '../outbound/outbound.module';
import { ReportExportService } from './framework/report-export.service';
import { ReportsFrameworkService } from './framework/reports-framework.service';
import { ReportsCacheService } from './reports-cache.service';
import { ReportsController } from './reports.controller';
import { ReportsPolicyConfig } from './reports-policy.config';
import { BillingReportsRunner } from './billing-reports.runner';
import { FinanceReportsRunner } from './finance-reports.runner';
import { InventoryIntelligenceReportsRunner } from './inventory-intelligence-reports.runner';
import { OperationalReportsRunner } from './operational-reports.runner';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    InventoryModule,
    InboundModule,
    OutboundModule,
    DashboardModule,
    CompaniesModule,
  ],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    ReportsCacheService,
    ReportsPolicyConfig,
    ReportsFrameworkService,
    ReportExportService,
    BillingReportsRunner,
    OperationalReportsRunner,
    InventoryIntelligenceReportsRunner,
    FinanceReportsRunner,
  ],
  exports: [ReportsService, ReportsFrameworkService],
})
export class ReportsModule {}
