import { Module } from '@nestjs/common';
import { CompanyAccessModule } from '../../common/company-access/company-access.module';

import { FinancialAccountsService } from './financial-accounts.service';
import { FinancialTransactionsService } from './financial-transactions.service';
import { FinancialPoliciesService } from './financial-policies.service';
import { FinancialCodService } from './financial-cod.service';
import { FinancialPayoutsService } from './financial-payouts.service';
import { FinancialCarrierCostsService } from './financial-carrier-costs.service';
import { FinancialFloatReconciliationService } from './financial-float-reconciliation.service';
import { FinancialController } from './financial.controller';
import { ClientFinancialController } from './client-financial.controller';

@Module({
  imports: [CompanyAccessModule],
  controllers: [FinancialController, ClientFinancialController],
  providers: [
    FinancialAccountsService,
    FinancialTransactionsService,
    FinancialPoliciesService,
    FinancialCodService,
    FinancialPayoutsService,
    FinancialCarrierCostsService,
    FinancialFloatReconciliationService,
  ],
  exports: [
    FinancialAccountsService,
    FinancialTransactionsService,
    FinancialPoliciesService,
    FinancialCodService,
    FinancialPayoutsService,
    FinancialCarrierCostsService,
    FinancialFloatReconciliationService,
  ],
})
export class FinancialModule {}
