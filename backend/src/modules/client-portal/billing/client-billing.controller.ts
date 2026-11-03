import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';

import { Public } from '../../../common/auth/public.decorator';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { ClientUser } from '../auth/client-user.decorator';
import { JwtClientAuthGuard } from '../auth/jwt-client-auth.guard';
import { ClientBillingService } from './client-billing.service';
import { BillingOnDemandService } from '../../billing/on-demand/billing-on-demand.service';

/**
 * Client portal billing — read-only, always scoped to the signed-in client's company.
 * `GET /api/client/billing/*`
 */
@Public()
@UseGuards(JwtClientAuthGuard)
@Controller('client/billing')
export class ClientBillingController {
  constructor(
    private readonly billing: ClientBillingService,
    private readonly onDemand: BillingOnDemandService,
  ) {}

  @Get('access')
  access(@ClientUser() client: ClientPrincipal) {
    return this.billing.getAccess(client);
  }

  @Get('summary')
  summary(@ClientUser() client: ClientPrincipal) {
    return this.billing.getSummary(client);
  }

  @Get('invoices')
  listInvoices(
    @ClientUser() client: ClientPrincipal,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
  ) {
    const parsedLimit = limit != null ? Number(limit) : undefined;
    const parsedOffset = offset != null ? Number(offset) : undefined;
    if (parsedLimit != null || parsedOffset != null || status) {
      return this.billing.listInvoicesPage(client, {
        limit: Number.isFinite(parsedLimit) ? parsedLimit! : 50,
        offset: Number.isFinite(parsedOffset) ? parsedOffset! : 0,
        status,
      });
    }
    return this.billing.listInvoices(client);
  }

  @Get('invoices/export')
  async exportInvoices(
    @ClientUser() client: ClientPrincipal,
    @Res() res: Response,
    @Query('status') status?: string,
  ) {
    const buffer = await this.billing.exportInvoicesXlsx(client, status);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="invoices-report.xlsx"',
    );
    res.send(buffer);
  }

  /** Order counts, statuses and fees for the client's own invoice. External carrier costs are never included. */
  @Get('invoices/:id/breakdown')
  invoiceBreakdown(@ClientUser() client: ClientPrincipal, @Param('id') id: string) {
    return this.onDemand.breakdown({ companyId: client.companyId }, id, 'client');
  }

  @Get('invoices/:id')
  getInvoice(@ClientUser() client: ClientPrincipal, @Param('id') id: string) {
    return this.billing.getInvoice(client, id);
  }
}
