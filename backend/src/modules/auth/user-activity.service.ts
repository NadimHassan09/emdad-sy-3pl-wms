import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';

/** Minimum interval between persisting activity for the same user (reduces write load). */
const PERSIST_INTERVAL_MS = 90_000;

@Injectable()
export class UserActivityService {
  private readonly lastPersistMs = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  /** Fire-and-forget: bumps `users.last_activity_at` at most once per `PERSIST_INTERVAL_MS` per user. */
  touch(userId: string): void {
    const now = Date.now();
    const prev = this.lastPersistMs.get(userId) ?? 0;
    if (now - prev < PERSIST_INTERVAL_MS) return;
    this.lastPersistMs.set(userId, now);

    void this.prisma.user
      .update({
        where: { id: userId },
        data: { lastActivityAt: new Date() },
      })
      .catch(() => {
        this.lastPersistMs.delete(userId);
      });
  }
}
