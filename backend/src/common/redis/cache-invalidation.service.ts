import { Injectable } from '@nestjs/common';

import { RedisService } from './redis.service';
import { CACHE_PREFIX, INVALIDATION_BY_TRIGGER } from './cache-invalidation.map';

@Injectable()
export class CacheInvalidationService {
  constructor(private readonly redis: RedisService) {}

  /** After inbound confirm/receive, outbound confirm, adjustment approve — stock / ledger semantics can change summaries. */
  async afterStockOrLedgerMutation(): Promise<void> {
    await Promise.all(
      [...INVALIDATION_BY_TRIGGER.stockOrLedger].map((p) => this.redis.deleteByPrefix(p)),
    );
  }

  /** Task / workflow timeline views (server-side caches, if enabled). */
  async afterTaskMutation(): Promise<void> {
    await Promise.all(
      [...INVALIDATION_BY_TRIGGER.warehouseTaskOrWorkflowUi].map((p) =>
        this.redis.deleteByPrefix(p),
      ),
    );
  }

  async afterTaskAndStockMutation(): Promise<void> {
    await Promise.all(
      [...INVALIDATION_BY_TRIGGER.taskAndStock].map((p) => this.redis.deleteByPrefix(p)),
    );
  }

  async invalidateProducts(): Promise<void> {
    await this.redis.deleteByPrefix(CACHE_PREFIX.products);
  }

  async invalidateLocationTrees(): Promise<void> {
    await this.redis.deleteByPrefix(CACHE_PREFIX.locations);
  }

  async invalidateBarcodeKey(normalizedBarcode: string): Promise<void> {
    await this.redis.del(`barcode:${normalizedBarcode}`);
  }
}
