import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../common/prisma/prisma.service';
import { ShippingTrackingService } from './shipping-tracking.service';

@Injectable()
export class ShippingSyncScheduler {
  private readonly logger = new Logger(ShippingSyncScheduler.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly trackingService: ShippingTrackingService,
  ) {}

  /**
   * Periodic background job that polls live tracking status for in-flight shipments.
   * Runs every 10 minutes by default as a fallback to ensure no status change is missed.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async handlePeriodicTrackingSync(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug('Periodic shipping tracking sync already in progress. Skipping cycle.');
      return;
    }

    this.isRunning = true;
    try {
      // Find up to 50 in-flight carrier shipments needing tracking update
      const shipments = await this.prisma.carrierShipment.findMany({
        where: {
          status: 'created',
          externalAwb: { not: null },
          OR: [
            { lastTrackingStatus: null },
            {
              lastTrackingStatus: {
                notIn: ['delivered', 'returned', 'cancelled'],
              },
            },
          ],
          outboundOrder: {
            status: {
              in: ['ready_to_ship', 'shipped', 'out_for_delivery'],
            },
          },
        },
        select: {
          id: true,
          externalAwb: true,
          providerCode: true,
          pollAttemptsCount: true,
          outboundOrder: { select: { orderNumber: true } },
        },
        orderBy: { lastTrackingAt: { sort: 'asc', nulls: 'first' } },
        take: 50,
      });

      if (shipments.length === 0) {
        return;
      }

      this.logger.log(`Starting periodic tracking sync for ${shipments.length} in-flight shipment(s)...`);

      let updatedCount = 0;
      for (const shipment of shipments) {
        const awb = shipment.externalAwb;
        if (!awb) continue;

        try {
          const res = await this.trackingService.syncShipmentByAwb(awb, shipment.providerCode);
          if (res.success) {
            updatedCount++;
          }
          await this.prisma.carrierShipment.update({
            where: { id: shipment.id },
            data: {
              pollAttemptsCount: { increment: 1 },
              lastTrackingAt: new Date(),
            },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Failed tracking sync for AWB ${awb} (${shipment.providerCode}): ${msg}`);
        }
      }

      this.logger.log(`Periodic tracking sync completed: ${updatedCount}/${shipments.length} shipments processed.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error during periodic shipping tracking sync: ${msg}`);
    } finally {
      this.isRunning = false;
    }
  }
}
