import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PrismaService } from '../../common/prisma/prisma.service';
import {
  BillingNotificationsService,
  type ExpiryReminderDay,
} from './billing-notifications.service';

const MS_PER_DAY = 86_400_000;

/**
 * Sends deduplicated billing-cycle expiry reminders at 30/14/7/3/1 days before end.
 */
@Injectable()
export class BillingExpiryReminderService {
  private readonly log = new Logger(BillingExpiryReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: BillingNotificationsService,
  ) {}

  @Cron('0 8 * * *')
  async tick() {
    try {
      const sent = await this.sendDueReminders();
      if (sent > 0) {
        this.log.log(`Sent ${sent} billing expiry reminder(s).`);
      }
    } catch (err) {
      this.log.error('Billing expiry reminder tick failed', err);
    }
  }

  async sendDueReminders(): Promise<number> {
    const now = new Date();
    let sent = 0;

    for (const days of this.notifications.expiryReminderDays()) {
      const windowStart = new Date(now.getTime() + (days - 1) * MS_PER_DAY);
      const windowEnd = new Date(now.getTime() + days * MS_PER_DAY);

      const cycles = await this.prisma.billingCycle.findMany({
        where: {
          status: { in: ['active', 'renewed'] },
          endsAt: { gt: now, gte: windowStart, lt: windowEnd },
        },
        select: {
          id: true,
          companyId: true,
          endsAt: true,
          company: { select: { name: true } },
        },
      });

      for (const cycle of cycles) {
        const daysRemaining = Math.ceil(
          (cycle.endsAt.getTime() - now.getTime()) / MS_PER_DAY,
        ) as ExpiryReminderDay;
        if (!this.notifications.expiryReminderDays().includes(daysRemaining)) continue;

        await this.notifications.notifyCycleExpiring({
          companyId: cycle.companyId,
          companyName: cycle.company.name,
          cycleId: cycle.id,
          endsAt: cycle.endsAt,
          daysRemaining,
        });
        sent += 1;
      }
    }

    return sent;
  }
}
