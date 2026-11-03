import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { InternalAdminGuard } from '../../common/auth/internal-admin.guard';
import { ParseUuidLoosePipe } from '../../common/pipes/parse-uuid-loose.pipe';
import { FinancialAccountsService } from './financial-accounts.service';
import { FinancialTransactionsService } from './financial-transactions.service';
import { FinancialPoliciesService } from './financial-policies.service';
import { FinancialCodService } from './financial-cod.service';
import { FinancialPayoutsService } from './financial-payouts.service';
import { FinancialCarrierCostsService } from './financial-carrier-costs.service';
import {
  ConfirmCodCollectionDto,
  ConfirmCodRemittanceDto,
  ListCodFinancialQueryDto,
  ListFinancialTransactionsQueryDto,
  ListPayoutsQueryDto,
  PostManualAdjustmentDto,
  RecordPayoutPaidDto,
  ReviewPayoutDto,
  UpdateFinancialPolicyDto,
} from './dto/financial.dto';

@UseGuards(InternalAdminGuard)
@Controller('finance')
export class FinancialController {
  constructor(
    private readonly accounts: FinancialAccountsService,
    private readonly transactions: FinancialTransactionsService,
    private readonly policies: FinancialPoliciesService,
    private readonly cod: FinancialCodService,
    private readonly payouts: FinancialPayoutsService,
    private readonly carrierCosts: FinancialCarrierCostsService,
  ) {}

  @Get('overview')
  getOverview() {
    return this.accounts.getFinancialOverview();
  }

  /** Audit (dryRun, default) or repair pending balances and COD USD amounts. Super admin only. */
  @Post('accounts/reconcile')
  reconcile(@CurrentUser() user: AuthPrincipal, @Body() body: { dryRun?: boolean }) {
    if (user.role !== 'super_admin') {
      throw new ForbiddenException('Only a super admin can reconcile finance accounts.');
    }
    return this.accounts.reconcileAccounts(body?.dryRun !== false);
  }

  @Get('accounts')
  listAccounts(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.accounts.listAccounts({
      search,
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 25,
    });
  }

  @Get('accounts/:companyId')
  getAccount(@Param('companyId', ParseUuidLoosePipe) companyId: string) {
    return this.accounts.getAccount(companyId);
  }

  @Get('transactions')
  listTransactions(
    @Query() query: ListFinancialTransactionsQueryDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.transactions.listTransactions(query, user);
  }

  @Post('transactions/adjustment')
  createAdjustment(
    @Body() dto: PostManualAdjustmentDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.transactions.createManualAdjustment(dto, user);
  }

  @Get('cod')
  listCod(
    @Query() query: ListCodFinancialQueryDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.cod.listCodFinancial(query, user);
  }

  @Post('cod/:id/confirm-collection')
  confirmCodCollection(
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: ConfirmCodCollectionDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.cod.confirmCarrierCollection(id, user, dto.notes);
  }

  @Post('cod/:id/confirm-remittance')
  confirmCodRemittance(
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: ConfirmCodRemittanceDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.cod.confirmCarrierRemittance(
      id,
      user,
      dto.remittanceReference,
      dto.notes,
    );
  }

  @Get('payouts')
  listPayouts(
    @Query() query: ListPayoutsQueryDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.payouts.listPayouts(query, user);
  }

  @Patch('payouts/:id/review')
  reviewPayout(
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: ReviewPayoutDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.payouts.reviewPayout(id, dto, user);
  }

  @Post('payouts/:id/record-paid')
  recordPayoutPaid(
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: RecordPayoutPaidDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.payouts.recordPayoutPaid(id, dto, user);
  }

  @Get('policies')
  getPolicies() {
    return this.policies.getAllPolicies();
  }

  @Put('policies/:key')
  updatePolicy(
    @Param('key') key: string,
    @Body() dto: UpdateFinancialPolicyDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.policies.updatePolicy(key, dto.value, user.id, dto.description);
  }

  @Get('carrier-costs')
  listCarrierCosts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('providerCode') providerCode?: string,
    @Query('search') search?: string,
    @Query('paidStatus') paidStatus?: 'paid' | 'unpaid' | 'all',
  ) {
    return this.carrierCosts.listCarrierCosts({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 25,
      providerCode,
      search,
      paidStatus,
    });
  }

  @Post('carrier-costs/:id/mark-paid')
  markCarrierCostPaid(
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() body: { reference?: string; notes?: string },
  ) {
    return this.carrierCosts.markCarrierCostPaid(id, body);
  }
}
