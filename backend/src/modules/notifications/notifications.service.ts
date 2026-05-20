import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationChannel, Prisma, UserRole, UserStatus } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';

const IN_APP_CHANNELS: NotificationChannel[] = [
  NotificationChannel.in_app,
  NotificationChannel.both,
];

const ADMIN_NOTIFY_ROLES: UserRole[] = [
  UserRole.super_admin,
  UserRole.wh_manager,
  UserRole.wh_operator,
];

export type OrderNotificationTarget = {
  companyId: string;
  orderId: string;
  orderNumber: string;
};

export type NotificationDto = {
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
}): NotificationDto {
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
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private scopeWhere(user: AuthPrincipal): Prisma.NotificationWhereInput {
    return {
      channel: { in: IN_APP_CHANNELS },
      userId: user.id,
    };
  }

  async list(user: AuthPrincipal, limit = 50): Promise<{
    items: NotificationDto[];
    unreadCount: number;
  }> {
    const where = this.scopeWhere(user);
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

  async markRead(user: AuthPrincipal, id: string): Promise<NotificationDto> {
    const row = await this.prisma.notification.findFirst({
      where: { id, ...this.scopeWhere(user) },
    });
    if (!row) throw new NotFoundException('Notification not found.');
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
    return toDto(updated);
  }

  async markAllRead(user: AuthPrincipal): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { ...this.scopeWhere(user), isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { updated: result.count };
  }

  /** Notify warehouse staff when a client adds a product to their catalog. */
  async notifyAdminsClientProductAdded(input: {
    companyId: string;
    companyName: string;
    productId: string;
    productSku: string;
    productName: string;
  }): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: {
        status: UserStatus.active,
        role: { in: ADMIN_NOTIFY_ROLES },
      },
      select: { id: true },
    });
    if (admins.length === 0) return;

    const skuRef = input.productSku || input.productId.slice(0, 8);

    await this.prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        type: 'admin_client_product_added',
        title: 'New client product',
        body: `${input.companyName} added product ${skuRef} — ${input.productName}.`,
        referenceType: 'product',
        referenceId: input.productId,
        channel: NotificationChannel.in_app,
      })),
    });
  }

  /** Notify warehouse staff when a client order awaits approval. */
  async notifyAdminsPendingApproval(input: {
    companyId: string;
    companyName: string;
    orderType: 'inbound' | 'outbound';
    orderId: string;
    orderNumber: string;
  }): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: {
        status: UserStatus.active,
        role: { in: ADMIN_NOTIFY_ROLES },
      },
      select: { id: true },
    });
    if (admins.length === 0) return;

    const type =
      input.orderType === 'inbound'
        ? 'admin_inbound_pending_approval'
        : 'admin_outbound_pending_approval';
    const referenceType = input.orderType === 'inbound' ? 'inbound_order' : 'outbound_order';
    const label = input.orderType === 'inbound' ? 'Inbound' : 'Outbound';
    const orderRef = input.orderNumber || input.orderId.slice(0, 8);

    await this.prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        type,
        title: `${label} order needs approval`,
        body: `${input.companyName}: ${label.toLowerCase()} order ${orderRef} is waiting for your approval.`,
        referenceType,
        referenceId: input.orderId,
        channel: NotificationChannel.in_app,
      })),
    });
  }

  async dismissPendingAdminNotifications(
    referenceType: 'inbound_order' | 'outbound_order',
    referenceId: string,
  ): Promise<void> {
    const type =
      referenceType === 'inbound_order'
        ? 'admin_inbound_pending_approval'
        : 'admin_outbound_pending_approval';
    await this.prisma.notification.updateMany({
      where: { referenceType, referenceId, type, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /** Notify client company users when the warehouse confirms their order. */
  async notifyClientOrderConfirmed(input: {
    companyId: string;
    orderType: 'inbound' | 'outbound';
    orderId: string;
    orderNumber: string;
  }): Promise<void> {
    const referenceType = input.orderType === 'inbound' ? 'inbound_order' : 'outbound_order';
    const type =
      input.orderType === 'inbound' ? 'inbound_order_confirmed' : 'outbound_order_confirmed';
    const label = input.orderType === 'inbound' ? 'Inbound' : 'Outbound';
    const ref = input.orderNumber || input.orderId.slice(0, 8);

    await this.createClientNotificationOnce({
      companyId: input.companyId,
      type,
      title: `${label} order confirmed`,
      body: `Your ${label.toLowerCase()} order ${ref} was confirmed by the warehouse.`,
      referenceType,
      referenceId: input.orderId,
    });
  }

  /** Notify client company when an inbound order is completed or outbound order is shipped. */
  async notifyClientOrderCompleted(input: {
    companyId: string;
    orderType: 'inbound' | 'outbound';
    orderId: string;
    orderNumber: string;
  }): Promise<void> {
    const referenceType = input.orderType === 'inbound' ? 'inbound_order' : 'outbound_order';
    const type =
      input.orderType === 'inbound' ? 'inbound_order_completed' : 'outbound_order_completed';
    const label = input.orderType === 'inbound' ? 'Inbound' : 'Outbound';
    const ref = input.orderNumber || input.orderId.slice(0, 8);
    const title =
      input.orderType === 'inbound' ? `${label} order completed` : `${label} order shipped`;
    const body =
      input.orderType === 'inbound'
        ? `Your inbound order ${ref} has been received and completed.`
        : `Your outbound order ${ref} has been shipped.`;

    await this.createClientNotificationOnce({
      companyId: input.companyId,
      type,
      title,
      body,
      referenceType,
      referenceId: input.orderId,
    });
  }

  private async createClientNotificationOnce(input: {
    companyId: string;
    type: string;
    title: string;
    body: string;
    referenceType: string;
    referenceId: string;
  }): Promise<void> {
    const existing = await this.prisma.notification.findFirst({
      where: {
        companyId: input.companyId,
        type: input.type,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
      },
      select: { id: true },
    });
    if (existing) return;

    await this.prisma.notification.create({
      data: {
        companyId: input.companyId,
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
