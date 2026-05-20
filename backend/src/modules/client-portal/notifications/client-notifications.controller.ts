import { Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { Public } from '../../../common/auth/public.decorator';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { ParseUuidLoosePipe } from '../../../common/pipes/parse-uuid-loose.pipe';
import { ClientUser } from '../auth/client-user.decorator';
import { JwtClientAuthGuard } from '../auth/jwt-client-auth.guard';
import { ClientNotificationsService } from './client-notifications.service';

@Controller('client/notifications')
export class ClientNotificationsController {
  constructor(private readonly notifications: ClientNotificationsService) {}

  @Public()
  @Get()
  @UseGuards(JwtClientAuthGuard)
  list(@ClientUser() client: ClientPrincipal, @Query('limit') limit?: string) {
    const n = limit ? Number(limit) : 50;
    return this.notifications.list(client, Number.isFinite(n) ? n : 50);
  }

  @Public()
  @Patch(':id/read')
  @UseGuards(JwtClientAuthGuard)
  markRead(@ClientUser() client: ClientPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.notifications.markRead(client, id);
  }

  @Public()
  @Post('read-all')
  @UseGuards(JwtClientAuthGuard)
  markAllRead(@ClientUser() client: ClientPrincipal) {
    return this.notifications.markAllRead(client);
  }
}
