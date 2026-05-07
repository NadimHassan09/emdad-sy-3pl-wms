import { Controller, Get } from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  /** Open inbound/outbound orders grouped for dashboard pie charts. */
  @Get('open-orders-charts')
  openOrdersCharts(@CurrentUser() user: AuthPrincipal) {
    return this.dashboard.openOrdersCharts(user);
  }
}
