import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsString, MaxLength } from 'class-validator';

import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { Public } from '../../../common/auth/public.decorator';
import { ParseUuidLoosePipe } from '../../../common/pipes/parse-uuid-loose.pipe';
import { ClientUser } from '../auth/client-user.decorator';
import { JwtClientAuthGuard } from '../auth/jwt-client-auth.guard';
import { ClientWebhooksService } from './client-webhooks.service';

class CreateWebhookDto {
  @IsString()
  @MaxLength(500)
  url!: string;
}

class SetEnabledDto {
  @IsBoolean()
  enabled!: boolean;
}

@Public()
@UseGuards(JwtClientAuthGuard)
@Controller('client/webhooks')
export class ClientWebhooksController {
  constructor(private readonly webhooks: ClientWebhooksService) {}

  @Get()
  list(@ClientUser() client: ClientPrincipal) {
    return this.webhooks.list(client);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  create(@ClientUser() client: ClientPrincipal, @Body() dto: CreateWebhookDto) {
    return this.webhooks.create(client, dto.url);
  }

  @Post(':id/rotate-secret')
  rotate(@ClientUser() client: ClientPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.webhooks.rotateSecret(client, id);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/test')
  test(@ClientUser() client: ClientPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.webhooks.sendTest(client, id);
  }

  @Patch(':id/enabled')
  setEnabled(
    @ClientUser() client: ClientPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: SetEnabledDto,
  ) {
    return this.webhooks.setEnabled(client, id, dto.enabled);
  }

  @Get(':id/deliveries')
  deliveries(@ClientUser() client: ClientPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.webhooks.deliveries(client, id);
  }

  @Delete(':id')
  remove(@ClientUser() client: ClientPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.webhooks.remove(client, id);
  }
}
