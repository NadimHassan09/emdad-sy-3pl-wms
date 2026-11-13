import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';

import { Public } from '../../common/auth/public.decorator';
import { ClientPrincipal } from '../../common/auth/client-principal.types';
import {
  parseExportFormat,
  sendTabularExport,
} from '../../common/utils/tabular-export.util';
import { ClientUser } from '../client-portal/auth/client-user.decorator';
import { JwtClientAuthGuard } from '../client-portal/auth/jwt-client-auth.guard';
import { FinancialAccountsService } from './financial-accounts.service';
import { FinancialTransactionsService } from './financial-transactions.service';
import { FinancialPayoutsService } from './financial-payouts.service';
import { FinancialCodService } from './financial-cod.service';
import { FinancialPoliciesService } from './financial-policies.service';
import {
  CreateClientPayoutRequestDto,
  ExportFinancialTransactionsQueryDto,
  ListCodFinancialQueryDto,
  ListFinancialTransactionsQueryDto,
  ListPayoutsQueryDto,
} from './dto/financial.dto';

/**
 * Client Portal Financial Management — strictly scoped to authenticated client's company.
 * Internal carrier costs, margins, and system policies are NEVER exposed here.
 */
@Public()
@UseGuards(JwtClientAuthGuard)
@Controller('client/finances')
export class ClientFinancialController {
  constructor(
    private readonly accounts: FinancialAccountsService,
    private readonly transactions: FinancialTransactionsService,
    private readonly payouts: FinancialPayoutsService,
    private readonly cod: FinancialCodService,
    private readonly policies: FinancialPoliciesService,
  ) {}

  @Get('account')
  async getAccount(@ClientUser() client: ClientPrincipal) {
    const acc = await this.accounts.getAccount(client.companyId);
    // B12 client shield: hide in-transit / liquidity gap from the client view.
    const shield = await this.policies.isFlagEnabled('client_shield_enabled');
    const pending = shield ? '0' : acc.pendingBalance.toString();
    return {
      companyId: acc.companyId,
      currentBalance: acc.currentBalance.toString(),
      availableBalance: acc.availableBalance.toString(),
      pendingBalance: pending,
      payoutLocked: acc.payoutLocked.toString(),
      totalCredits: acc.totalCredits.toString(),
      totalDebits: acc.totalDebits.toString(),
      currency: acc.currency,
      status: acc.status,
      lastTransactionAt: acc.lastTransactionAt,
    };
  }

  @Get('transactions/export')
  async exportTransactions(
    @ClientUser() client: ClientPrincipal,
    @Query() query: ExportFinancialTransactionsQueryDto,
    @Res() res: Response,
  ) {
    const result = await this.transactions.exportTransactions(
      { ...query, companyId: client.companyId },
      parseExportFormat(query.format),
      { companyId: client.companyId },
    );
    return sendTabularExport(res, result);
  }

  @Get('transactions')
  listTransactions(
    @ClientUser() client: ClientPrincipal,
    @Query() query: ListFinancialTransactionsQueryDto,
  ) {
    return this.transactions.listTransactions(
      { ...query, companyId: client.companyId },
      { companyId: client.companyId },
    );
  }

  @Get('payouts')
  listPayouts(
    @ClientUser() client: ClientPrincipal,
    @Query() query: ListPayoutsQueryDto,
  ) {
    return this.payouts.listPayouts(
      { ...query, companyId: client.companyId },
      { companyId: client.companyId },
    );
  }

  @Post('payouts/request')
  requestPayout(
    @ClientUser() client: ClientPrincipal,
    @Body() dto: CreateClientPayoutRequestDto,
  ) {
    return this.payouts.requestPayout(client.companyId, dto, client.id);
  }

  @Get('cod')
  listCod(
    @ClientUser() client: ClientPrincipal,
    @Query() query: ListCodFinancialQueryDto,
  ) {
    return this.cod.listCodFinancial(
      { ...query, companyId: client.companyId },
      { companyId: client.companyId },
    );
  }
}
