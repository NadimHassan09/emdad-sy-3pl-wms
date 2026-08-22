import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { OmsSalesChannelType, Prisma } from '@prisma/client';

import { AuthPrincipal } from '../../../common/auth/current-user.types';
import { readCompanyIdFilterRequired } from '../../../common/auth/company-read-scope';
import { CompanyAccessService } from '../../../common/company-access/company-access.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { withTenantRls } from '../../../common/prisma/tenant-rls';
import { CreateOmsSalesChannelDto } from '../dto/sales-channel.dto';
import { resolveChannelHandler } from './oms-channel-handlers.registry';
import {
  generateWebhookSecret,
  hashWebhookSecret,
  verifyWebhookSecret,
} from './oms-channel.util';

@Injectable()
export class OmsSalesChannelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyAccess: CompanyAccessService,
  ) {}

  async list(user: AuthPrincipal, companyId?: string) {
    const cid = readCompanyIdFilterRequired(this.companyAccess, user, companyId);
    return withTenantRls(this.prisma, user, (tx) =>
      tx.omsSalesChannel.findMany({
        where: { companyId: cid },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          companyId: true,
          channelType: true,
          name: true,
          externalStoreId: true,
          isActive: true,
          config: true,
          lastSyncAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    );
  }

  async create(user: AuthPrincipal, dto: CreateOmsSalesChannelDto) {
    const companyId = readCompanyIdFilterRequired(this.companyAccess, user, dto.companyId);
    if (!companyId) {
      throw new BadRequestException('companyId is required.');
    }
    const webhookSecret = generateWebhookSecret();

    const row = await withTenantRls(this.prisma, user, (tx) =>
      tx.omsSalesChannel.create({
        data: {
          companyId,
          channelType: dto.channelType,
          name: dto.name.trim(),
          externalStoreId: dto.externalStoreId?.trim() || null,
          webhookSecretHash: hashWebhookSecret(webhookSecret),
          ...(dto.config !== undefined
            ? { config: dto.config as Prisma.InputJsonValue }
            : {}),
        },
      }),
    );

    return {
      channel: {
        id: row.id,
        companyId: row.companyId,
        channelType: row.channelType,
        name: row.name,
        externalStoreId: row.externalStoreId,
        isActive: row.isActive,
        webhookUrl: `/api/oms/webhooks/inbound/${row.id}`,
      },
      webhookSecret,
    };
  }

  async processInboundWebhook(
    channelId: string,
    secret: string | undefined,
    input: {
      eventType?: string;
      externalId?: string;
      payload: Record<string, unknown>;
    },
  ) {
    const channel = await this.prisma.omsSalesChannel.findUnique({
      where: { id: channelId },
    });
    if (!channel || !channel.isActive) {
      throw new NotFoundException('Sales channel not found.');
    }
    if (!secret || !verifyWebhookSecret(secret, channel.webhookSecretHash)) {
      throw new UnauthorizedException('Invalid webhook secret.');
    }

    const handler = resolveChannelHandler(channel.channelType as OmsSalesChannelType);
    const result = await handler({
      companyId: channel.companyId,
      channelType: channel.channelType,
      channelId: channel.id,
      payload: input.payload,
    });

    const event = await this.prisma.omsIntegrationEvent.create({
      data: {
        companyId: channel.companyId,
        salesChannelId: channel.id,
        eventType: input.eventType ?? 'order.inbound',
        externalId: input.externalId ?? result.externalId,
        payload: input.payload as Prisma.InputJsonValue,
        status: result.accepted ? 'accepted' : 'rejected',
        errorMessage: result.accepted ? null : result.message,
      },
    });

    if (!result.accepted) {
      throw new BadRequestException(result.message ?? 'Webhook rejected by channel handler.');
    }

    return {
      integrationEventId: event.id,
      status: event.status,
      message: result.message,
    };
  }
}
