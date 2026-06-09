import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { Public } from '../../../common/auth/public.decorator';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { ClientUser } from '../auth/client-user.decorator';
import { JwtClientAuthGuard } from '../auth/jwt-client-auth.guard';
import { ClientBillingService } from './client-billing.service';

/**
 * Client portal billing — read-only, always scoped to the signed-in client's company.
 * `GET /api/client/billing/*`
 */
@Public()
@UseGuards(JwtClientAuthGuard)
@Controller('client/billing')
export class ClientBillingController {
  constructor(private readonly billing: ClientBillingService) {}

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

  @Get('invoices/:id')
  getInvoice(@ClientUser() client: ClientPrincipal, @Param('id') id: string) {
    return this.billing.getInvoice(client, id);
  }
}
