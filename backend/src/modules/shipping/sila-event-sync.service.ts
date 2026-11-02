import { Injectable, Logger } from '@nestjs/common';
import { ShippingProviderConnectionStatus } from '@prisma/client';

import { EncryptionService } from '../../common/crypto/encryption.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SilaSyAdapter } from './providers/sila-sy/sila-sy.adapter';
import { SilaSyApiError } from './providers/sila-sy/sila-sy.http-client';
import { SILA_SY_CODE } from './shipping.constants';
import { ShippingTrackingService } from './shipping-tracking.service';

@Injectable()
export class SilaEventSyncService {
  private readonly logger = new Logger(SilaEventSyncService.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly adapter: SilaSyAdapter,
    private readonly tracking: ShippingTrackingService,
  ) {}

  async syncUpdatedSince(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug('Sila updated_since sync already running. Skipping.');
      return;
    }
    this.isRunning = true;
    try {
      const connection = await this.prisma.shippingProviderConnection.findFirst({
        where: { provider: { code: SILA_SY_CODE } },
        include: { provider: true },
      });
      if (
        !connection ||
        connection.status !== ShippingProviderConnectionStatus.connected ||
        !connection.encryptedUsername
      ) {
        return;
      }

      const credentials = {
        username: this.encryption.decrypt(connection.encryptedUsername),
        password: connection.encryptedPassword
          ? this.encryption.decrypt(connection.encryptedPassword)
          : '',
      };

      const previous = connection.silaEventSyncAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
      let page = 1;
      let hasMore = true;
      let processed = 0;
      let newestProcessed: Date | null = null;
      let failed = false;

      while (hasMore) {
        let batch: { cargos: Record<string, any>[]; hasMore: boolean };
        try {
          batch = await this.adapter.listCargosUpdatedSince(
            credentials,
            previous.toISOString(),
            page,
            200,
          );
        } catch (err) {
          failed = true;
          const wait =
            err instanceof SilaSyApiError ? err.retryAfterSeconds : undefined;
          this.logger.warn(
            `Sila updated_since page ${page} failed${wait ? ` retry_after=${wait}s` : ''}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
          break;
        }

        for (const cargo of batch.cargos) {
          const token =
            (typeof cargo.id === 'string' && cargo.id.trim()) ||
            (typeof cargo.tracking_token === 'string' && cargo.tracking_token.trim()) ||
            (typeof cargo.barcode === 'string' && cargo.barcode.trim()) ||
            '';
          if (!token) continue;
          try {
            const event = await this.adapter.pollTracking(credentials, token);
            if (event) {
              event.costSource = 'poll';
              await this.tracking.processTrackingEvent(event);
            }
            processed += 1;
            const updatedAt = cargo.updated_at ? new Date(String(cargo.updated_at)) : null;
            if (updatedAt && !Number.isNaN(updatedAt.getTime())) {
              if (!newestProcessed || updatedAt > newestProcessed) newestProcessed = updatedAt;
            }
          } catch (err) {
            failed = true;
            this.logger.warn(
              `Sila updated_since cargo ${token} failed: ${
                err instanceof Error ? err.message : String(err)
              }`,
            );
            break;
          }
        }

        if (failed) break;
        hasMore = batch.hasMore === true;
        page += 1;
        if (page > 20) break;
      }

      if (!failed && newestProcessed) {
        await this.prisma.shippingProviderConnection.update({
          where: { id: connection.id },
          data: { silaEventSyncAt: newestProcessed },
        });
      }

      this.logger.log(
        `Sila updated_since sync finished: processed=${processed} advanced=${!failed && Boolean(newestProcessed)}`,
      );
    } finally {
      this.isRunning = false;
    }
  }
}
