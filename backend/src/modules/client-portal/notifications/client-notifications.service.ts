import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationChannel, Prisma } from '@prisma/client';

import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { notificationPayload } from '../../realtime/realtime-activity.payload';
import { RealtimeService } from '../../realtime/realtime.service';

const IN_APP_CHANNELS: NotificationChannel[] = [
  NotificationChannel.in_app,
  NotificationChannel.both,
];

export type ClientNotificationDto = {
  id: string;
  type: string;
  title: string;
  body: string;
  referenceType: string | null;
  referenceId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

function toDto(row: {
  id: string;
  type: string;
  title: string;
  body: string;
  referenceType: string | null;
  referenceId: string | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}): ClientNotificationDto {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    isRead: row.isRead,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class ClientNotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  /**
   * Client-visible notifications only:
   * - company-wide rows (`companyId` + no `userId`) from warehouse events
   * - rows addressed to this client user (`userId`)
   *
   * Excludes warehouse-admin rows that reuse `companyId` but set `userId` to an
   * internal staff account (those were appearing duplicated in the client bell).
   */
  private scopeWhere(client: ClientPrincipal): Prisma.NotificationWhereInput {
    return {
      channel: { in: IN_APP_CHANNELS },
      OR: [
        { companyId: client.companyId, userId: null },
        { userId: client.id },
      ],
    };
  }

  async list(
    client: ClientPrincipal,
    params: { limit?: number; offset?: number } = {},
  ): Promise<{
    items: ClientNotificationDto[];
    unreadCount: number;
    total: number;
    limit: number;
    offset: number;
  }> {
    const where = this.scopeWhere(client);
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
    const offset = Math.max(params.offset ?? 0, 0);
    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { ...where, isRead: false },
      }),
    ]);
    return {
      items: items.map(toDto),
      unreadCount,
      total,
      limit,
      offset,
    };
  }

  async markRead(client: ClientPrincipal, id: string): Promise<ClientNotificationDto> {
    const row = await this.prisma.notification.findFirst({
      where: { id, ...this.scopeWhere(client) },
    });
    if (!row) throw new NotFoundException('Notification not found.');
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
    const dto = toDto(updated);
    this.realtime.emitNotificationRead(client.id, { notification: notificationPayload(updated) });
    return dto;
  }

  async markAllRead(client: ClientPrincipal): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { ...this.scopeWhere(client), isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    this.realtime.emitNotificationRead(client.id, { markAllRead: true });
    return { updated: result.count };
  }

  /**
   * Notify all client users in a company (warehouse → client events).
   * Do not use for the client's own actions (submit order, add product).
   */
  async notifyCompany(
    companyId: string,
    input: {
      type: string;
      title: string;
      body: string;
      referenceType?: string;
      referenceId?: string;
    },
  ): Promise<void> {
    if (input.referenceType && input.referenceId) {
      const existing = await this.prisma.notification.findFirst({
        where: {
          companyId,
          userId: null,
          type: input.type,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
        },
        select: { id: true },
      });
      if (existing) return;
    }

    const created = await this.prisma.notification.create({
      data: {
        companyId,
        userId: null,
        type: input.type,
        title: input.title,
        body: input.body,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        channel: NotificationChannel.in_app,
      },
    });
    this.realtime.emitNotificationCreated(notificationPayload(created), { companyId });
  }
}
