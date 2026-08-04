import { Injectable } from '@nestjs/common';

import { MutationQueueService } from './mutation-queue.service';
import { RealtimeSyncModeService } from './realtime-sync-mode.service';

/**
 * Domain-facing publish API. Services call this after successful commit
 * (Architecture 2.2). Prefer publish over inventing socket events.
 */
@Injectable()
export class MutationBusService {
  constructor(
    private readonly queue: MutationQueueService,
    private readonly mode: RealtimeSyncModeService,
  ) {}

  publish(input: {
    mutationId: string;
    companyId?: string | null;
    userId?: string | null;
  }): void {
    if (!this.mode.emitSystemVersion()) return;
    this.queue.enqueue({
      mutationId: input.mutationId,
      companyId: input.companyId,
      userId: input.userId,
    });
  }
}
