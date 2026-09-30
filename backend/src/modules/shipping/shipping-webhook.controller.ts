import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';

import { Public } from '../../common/auth/public.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { ShippingProviderRegistry } from './shipping-provider.registry';
import { ShippingTrackingService } from './shipping-tracking.service';

@Controller('shipping/webhooks')
export class ShippingWebhookController {
  private readonly logger = new Logger(ShippingWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ShippingProviderRegistry,
    private readonly trackingService: ShippingTrackingService,
    private readonly encryption: EncryptionService,
  ) {}

  @Public()
  @Post(':providerCode')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('providerCode') providerCode: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: any,
  ) {
    const code = providerCode.toUpperCase().trim();
    this.logger.log(`Received incoming webhook for provider: ${code}`);

    const adapter = this.registry.get(code);
    if (!adapter) {
      this.logger.warn(`No shipping adapter registered for provider: ${code}`);
      throw new NotFoundException(`Unknown shipping provider: ${code}`);
    }

    // Handle handshake / test ping (e.g. Babel sends { type: 'test' } upon registration)
    if (body?.type === 'test') {
      this.logger.log(`Handshake test received from provider: ${code}`);
      return { status: 'success', message: 'Handshake accepted' };
    }

    // Retrieve provider connection and secret for signature verification
    const conn = await this.prisma.shippingProviderConnection.findFirst({
      where: { provider: { code } },
      select: { webhookSecret: true, encryptedPassword: true },
    });

    const secret =
      conn?.webhookSecret ||
      (conn?.encryptedPassword ? this.encryption.decrypt(conn.encryptedPassword) : undefined);

    if (adapter.verifyWebhook && secret) {
      const isValid = adapter.verifyWebhook(headers, body, secret);
      if (!isValid) {
        this.logger.warn(`Webhook signature verification failed for provider: ${code}`);
        throw new UnauthorizedException('Invalid webhook signature or secret');
      }
    }

    if (!adapter.normalizeWebhook) {
      this.logger.warn(`Provider ${code} does not implement normalizeWebhook.`);
      return { status: 'ignored', message: 'Webhooks not supported for provider' };
    }

    const event = adapter.normalizeWebhook(headers, body);
    if (!event) {
      this.logger.log(`Webhook payload from ${code} did not contain a valid tracking event.`);
      return { status: 'ignored', message: 'No tracking event parsed' };
    }

    const result = await this.trackingService.processTrackingEvent(event);
    return {
      status: 'success',
      action: result.action,
      orderId: result.orderId,
    };
  }
}
