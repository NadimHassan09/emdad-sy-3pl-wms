import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';

import { Public } from '../../../common/auth/public.decorator';
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../../common/auth/current-user.types';
import { ParseUuidLoosePipe } from '../../../common/pipes/parse-uuid-loose.pipe';
import { CreateOmsSalesChannelDto, OmsInboundWebhookDto } from '../dto/sales-channel.dto';
import { OmsSalesChannelService } from './oms-sales-channel.service';

@Controller('oms')
export class OmsWebhooksController {
  constructor(private readonly channels: OmsSalesChannelService) {}

  @Get('sales-channels')
  list(
    @CurrentUser() user: AuthPrincipal,
    @Query('companyId') companyId?: string,
  ) {
    return this.channels.list(user, companyId);
  }

  @Post('sales-channels')
  create(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateOmsSalesChannelDto) {
    return this.channels.create(user, dto);
  }

  @Public()
  @Post('webhooks/inbound/:channelId')
  inbound(
    @Param('channelId', ParseUuidLoosePipe) channelId: string,
    @Headers('x-webhook-secret') secret: string | undefined,
    @Body() body: OmsInboundWebhookDto,
  ) {
    return this.channels.processInboundWebhook(channelId, secret, {
      eventType: body.eventType,
      externalId: body.externalId,
      payload: body.payload,
    });
  }
}
