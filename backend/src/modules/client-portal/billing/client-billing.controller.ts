import { Controller, Get, Param, UseGuards } from '@nestjs/common';

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

  @Get('summary')
  summary(@ClientUser() client: ClientPrincipal) {
    return this.billing.getSummary(client);
  }

  @Get('invoices')
  listInvoices(@ClientUser() client: ClientPrincipal) {
    return this.billing.listInvoices(client);
  }

  @Get('invoices/:id')
  getInvoice(@ClientUser() client: ClientPrincipal, @Param('id') id: string) {
    return this.billing.getInvoice(client, id);
  }
}
