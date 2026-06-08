import { Controller, Get, UseGuards } from '@nestjs/common';

import { Public } from '../../../common/auth/public.decorator';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { ClientUser } from '../auth/client-user.decorator';
import { JwtClientAuthGuard } from '../auth/jwt-client-auth.guard';
import { ClientDashboardService } from './client-dashboard.service';

@Public()
@UseGuards(JwtClientAuthGuard)
@Controller('client/dashboard')
export class ClientDashboardController {
  constructor(private readonly dashboard: ClientDashboardService) {}

  @Get('overview')
  overview(@ClientUser() client: ClientPrincipal) {
    return this.dashboard.getOverview(client);
  }
}
