import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationChannel, Prisma } from '@prisma/client';

import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { PrismaService } from '../../../common/prisma/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

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

  async list(client: ClientPrincipal, limit = 50): Promise<{
    items: ClientNotificationDto[];
    unreadCount: number;
  }> {
    const where = this.scopeWhere(client);
    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(Math.max(limit, 1), 100),
      }),
      this.prisma.notification.count({
        where: { ...where, isRead: false },
      }),
    ]);
    return {
      items: items.map(toDto),
      unreadCount,
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
    return toDto(updated);
  }

  async markAllRead(client: ClientPrincipal): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { ...this.scopeWhere(client), isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
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

    await this.prisma.notification.create({
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
  }
}
