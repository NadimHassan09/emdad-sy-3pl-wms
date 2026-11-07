import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { Public } from '../../common/auth/public.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { isFatihWebhookTest } from './providers/fatih-cargo/fatih-cargo.webhook.util';
import { isSilaWebhookTest } from './providers/sila-sy/sila-webhook.util';
import { isSenaWebhookTest } from './providers/sena-express/sena-express.webhook.util';
import { ShippingProviderRegistry } from './shipping-provider.registry';
import { ShippingTrackingService } from './shipping-tracking.service';
import { FATIH_CARGO_CODE, SENA_EXPRESS_CODE, SILA_SY_CODE } from './shipping.constants';
import {
  buildShippingWebhookTimingLog,
  providerEventTimeIso,
} from './shipping-webhook-timing';

@Controller('shipping/webhooks')
export class ShippingWebhookController {
  private readonly logger = new Logger(ShippingWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ShippingProviderRegistry,
    private readonly trackingService: ShippingTrackingService,
  ) {}

  @Public()
  @Post(':providerCode')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('providerCode') providerCode: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: any,
    @Req() req: Request & { rawBody?: Buffer },
  ) {
    const code = providerCode.toUpperCase().trim();
    const receivedAt = new Date();
    const startedMs = Date.now();
    this.logger.log(`Received incoming webhook for provider: ${code}`);

    const adapter = this.registry.get(code);
    if (!adapter) {
      this.logger.warn(`No shipping adapter registered for provider: ${code}`);
      throw new NotFoundException(`Unknown shipping provider: ${code}`);
    }

    const conn = await this.prisma.shippingProviderConnection.findFirst({
      where: { provider: { code } },
      select: { webhookSecret: true },
    });

    const envSecret =
      code === SILA_SY_CODE
        ? process.env.SILA_WEBHOOK_SECRET?.trim()
        : code === SENA_EXPRESS_CODE
          ? process.env.SENA_WEBHOOK_SECRET?.trim()
          : code === FATIH_CARGO_CODE
            ? process.env.FATIH_WEBHOOK_SECRET?.trim()
            : undefined;
    const secret =
      code === SILA_SY_CODE || code === SENA_EXPRESS_CODE || code === FATIH_CARGO_CODE
        ? envSecret || conn?.webhookSecret || undefined
        : conn?.webhookSecret || undefined;

    const isRawHmacProvider =
      code === SILA_SY_CODE || code === SENA_EXPRESS_CODE || code === FATIH_CARGO_CODE;
    if (isRawHmacProvider && !req.rawBody && typeof body !== 'string') {
      this.logger.warn(`${code} webhook rejected: raw body missing for HMAC.`);
      throw new UnauthorizedException('Invalid webhook signature or secret');
    }

    const rawBody = req.rawBody ?? (typeof body === 'string' ? body : JSON.stringify(body ?? {}));

    const isHandshake =
      body?.type === 'test' ||
      body?.type === 'webhook.test' ||
      isSilaWebhookTest(headers, body) ||
      isSenaWebhookTest(headers, body) ||
      isFatihWebhookTest(body);

    if (adapter.verifyWebhook) {
      const verifyPayload = isRawHmacProvider ? rawBody : body;
      if (isRawHmacProvider && !secret) {
        this.logger.warn(`${code} webhook rejected: no webhook secret configured.`);
        throw new UnauthorizedException('Invalid webhook signature or secret');
      }
      if (!isHandshake && !secret) {
        this.logger.warn(`Webhook rejected: no dedicated signing key for provider: ${code}`);
        throw new UnauthorizedException('Invalid webhook signature or secret');
      }
      const isValid = adapter.verifyWebhook(headers, verifyPayload, secret);
      if (!isValid) {
        this.logger.warn(`Webhook signature verification failed for provider: ${code}`);
        throw new UnauthorizedException('Invalid webhook signature or secret');
      }
    }
    const verifiedMs = Date.now() - startedMs;

    if (isHandshake) {
      this.logger.log(`Handshake test received from provider: ${code}`);
      this.logWebhookTiming({
        providerCode: code,
        handshake: true,
        receivedAt,
        verifiedMs,
        processedMs: 0,
        totalMs: Date.now() - startedMs,
        providerEventTime: null,
        eventType: 'test',
        action: 'handshake',
      });
      return { status: 'success', message: 'Handshake accepted' };
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
    event.costSource = 'webhook';

    const processStartedMs = Date.now();
    const result = await this.trackingService.processTrackingEvent(event);
    const processedMs = Date.now() - processStartedMs;
    this.logWebhookTiming({
      providerCode: code,
      handshake: false,
      receivedAt,
      verifiedMs,
      processedMs,
      totalMs: Date.now() - startedMs,
      providerEventTime: providerEventTimeIso(body, event),
      awb: event.awb,
      eventType: event.eventType,
      externalEventId: event.externalEventId || event.deliveryId || null,
      action: result.action,
      orderId: result.orderId || null,
    });
    return {
      status: 'success',
      action: result.action,
      orderId: result.orderId,
    };
  }

  private logWebhookTiming(input: Parameters<typeof buildShippingWebhookTimingLog>[0]) {
    this.logger.log(JSON.stringify(buildShippingWebhookTimingLog(input)));
  }
}
