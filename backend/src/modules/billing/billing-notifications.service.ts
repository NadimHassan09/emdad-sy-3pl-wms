import { Injectable } from '@nestjs/common';
import { NotificationChannel, UserRole, UserStatus } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { notificationPayload } from '../realtime/realtime-activity.payload';
import { RealtimeService } from '../realtime/realtime.service';

const ADMIN_NOTIFY_ROLES: UserRole[] = [
  UserRole.super_admin,
  UserRole.wh_manager,
  UserRole.finance,
];

const EXPIRY_REMINDER_DAYS = [30, 14, 7, 3, 1] as const;
export type ExpiryReminderDay = (typeof EXPIRY_REMINDER_DAYS)[number];

@Injectable()
export class BillingNotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async notifyInvoiceOverdue(input: {
    companyId: string;
    companyName: string;
    invoiceId: string;
    invoiceNumber: string;
  }): Promise<void> {
    await this.notifyAdminsOnce({
      type: 'admin_billing_invoice_overdue',
      title: 'Invoice overdue',
      body: `${input.companyName}: invoice ${input.invoiceNumber} is past payment terms.`,
      referenceType: 'invoice',
      referenceId: input.invoiceId,
    });

    await this.createClientNotificationOnce({
      companyId: input.companyId,
      type: 'client_billing_invoice_overdue',
      title: 'Invoice overdue',
      body: `Your invoice ${input.invoiceNumber} is overdue. Please contact finance.`,
      referenceType: 'invoice',
      referenceId: input.invoiceId,
    });
  }

  async notifyInvoiceGenerated(input: {
    companyId: string;
    companyName: string;
    invoiceId: string;
    invoiceNumber: string;
    billingCycleId: string;
  }): Promise<void> {
    await this.notifyAdminsOnce({
      type: 'admin_billing_invoice_generated',
      title: 'Invoice generated',
      body: `${input.companyName}: invoice ${input.invoiceNumber} was issued for the billing cycle.`,
      referenceType: 'invoice',
      referenceId: input.invoiceId,
    });

    await this.createClientNotificationOnce({
      companyId: input.companyId,
      type: 'client_billing_invoice_generated',
      title: 'Invoice generated',
      body: `Your invoice ${input.invoiceNumber} has been generated and is ready for review.`,
      referenceType: 'invoice',
      referenceId: input.invoiceId,
    });
  }

  async notifyCycleExpiring(input: {
    companyId: string;
    companyName: string;
    cycleId: string;
    endsAt: Date;
    daysRemaining: ExpiryReminderDay;
  }): Promise<void> {
    const type = `admin_billing_cycle_expiring_${input.daysRemaining}d`;
    const clientType = `client_billing_cycle_expiring_${input.daysRemaining}d`;
    const endLabel = input.endsAt.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    await this.notifyAdminsOnce({
      type,
      title: `Billing cycle expiring in ${input.daysRemaining} day${input.daysRemaining === 1 ? '' : 's'}`,
      body: `${input.companyName}: billing cycle ends ${endLabel} (${input.daysRemaining} days remaining).`,
      referenceType: 'billing_cycle',
      referenceId: input.cycleId,
    });

    await this.createClientNotificationOnce({
      companyId: input.companyId,
      type: clientType,
      title: `Billing cycle expiring in ${input.daysRemaining} day${input.daysRemaining === 1 ? '' : 's'}`,
      body: `Your billing cycle ends on ${endLabel}. Contact your account manager to renew.`,
      referenceType: 'billing_cycle',
      referenceId: input.cycleId,
    });
  }

  async notifyAccountSuspended(input: {
    companyId: string;
    companyName: string;
    cycleId: string;
  }): Promise<void> {
    await this.notifyAdminsOnce({
      type: 'admin_billing_account_suspended',
      title: 'Account suspended',
      body: `${input.companyName} was restricted — billing cycle expired without renewal.`,
      referenceType: 'billing_cycle',
      referenceId: input.cycleId,
    });

    await this.createClientNotificationOnce({
      companyId: input.companyId,
      type: 'client_billing_account_suspended',
      title: 'Account suspended',
      body: 'Your account has been restricted because your billing cycle expired. Please renew to restore access.',
      referenceType: 'billing_cycle',
      referenceId: input.cycleId,
    });
  }

  async notifyAccountRenewed(input: {
    companyId: string;
    companyName: string;
    previousCycleId: string;
    nextCycleId: string;
  }): Promise<void> {
    await this.notifyAdminsOnce({
      type: 'admin_billing_account_renewed',
      title: 'Account renewed',
      body: `${input.companyName}: billing cycle renewed automatically.`,
      referenceType: 'billing_cycle',
      referenceId: input.nextCycleId,
    });

    await this.createClientNotificationOnce({
      companyId: input.companyId,
      type: 'client_billing_account_renewed',
      title: 'Account renewed',
      body: 'Your billing cycle has been renewed. Your account remains active.',
      referenceType: 'billing_cycle',
      referenceId: input.nextCycleId,
    });
  }

  expiryReminderDays(): readonly ExpiryReminderDay[] {
    return EXPIRY_REMINDER_DAYS;
  }

  private async notifyAdminsOnce(input: {
    type: string;
    title: string;
    body: string;
    referenceType: string;
    referenceId: string;
  }): Promise<void> {
    const existing = await this.prisma.notification.findFirst({
      where: {
        type: input.type,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
      },
      select: { id: true },
    });
    if (existing) return;

    const admins = await this.prisma.user.findMany({
      where: {
        status: UserStatus.active,
        role: { in: ADMIN_NOTIFY_ROLES },
      },
      select: { id: true },
    });
    if (admins.length === 0) return;

    await this.prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        type: input.type,
        title: input.title,
        body: input.body,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        channel: NotificationChannel.in_app,
      })),
    });

    const rows = await this.prisma.notification.findMany({
      where: {
        type: input.type,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        userId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    for (const row of rows) {
      if (!row.userId) continue;
      this.realtime.emitNotificationCreated(notificationPayload(row), { userId: row.userId });
    }
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

    const created = await this.prisma.notification.create({
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
    this.realtime.emitNotificationCreated(notificationPayload(created), {
      companyId: input.companyId,
    });
  }
}
