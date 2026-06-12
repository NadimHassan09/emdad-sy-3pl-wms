import { Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { ParseUuidLoosePipe } from '../../common/pipes/parse-uuid-loose.pipe';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthPrincipal,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('isRead') isRead?: string,
  ) {
    const parsedLimit = limit != null ? Number(limit) : undefined;
    const parsedOffset = offset != null ? Number(offset) : undefined;
    const readFilter =
      isRead === 'true' ? true : isRead === 'false' ? false : undefined;
    return this.notifications.list(user, {
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      offset: Number.isFinite(parsedOffset) ? parsedOffset : undefined,
      isRead: readFilter,
    });
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.notifications.markRead(user, id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: AuthPrincipal) {
    return this.notifications.markAllRead(user);
  }
}
