import { randomUUID } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

export type RefreshSessionIssue = {
  familyId: string;
  jti: string;
};

export type RefreshRotationResult = RefreshSessionIssue & {
  /** True when a parallel refresh replayed the same presented JTI safely. */
  idempotent: boolean;
};

/**
 * Server-side refresh token families with one-time rotation and reuse detection.
 */
@Injectable()
export class RefreshSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(
    userId: string,
    tokenVersion: number,
    expiresAt: Date,
  ): Promise<RefreshSessionIssue> {
    const familyId = randomUUID();
    const jti = randomUUID();
    await this.prisma.authRefreshSession.create({
      data: {
        id: familyId,
        userId,
        currentJti: jti,
        tokenVersion,
        expiresAt,
      },
    });
    return { familyId, jti };
  }

  /**
   * Rotate refresh JTI inside a family. Detects stolen-token reuse and revokes all
   * active families for the user when a previously consumed JTI is presented again.
   */
  async rotateSession(
    userId: string,
    tokenVersion: number,
    familyId: string,
    presentedJti: string,
  ): Promise<RefreshRotationResult> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockSessionRow(tx, familyId);

      const session = await tx.authRefreshSession.findUnique({
        where: { id: familyId },
      });
      if (!session || session.userId !== userId) {
        throw new UnauthorizedException('Session is no longer valid.');
      }
      if (session.revokedAt) {
        throw new UnauthorizedException('Session has been invalidated. Please log in again.');
      }
      if (session.expiresAt.getTime() <= Date.now()) {
        throw new UnauthorizedException('Refresh session has expired. Please log in again.');
      }
      if (session.tokenVersion !== tokenVersion) {
        throw new UnauthorizedException('Session has been invalidated. Please log in again.');
      }

      if (session.currentJti === presentedJti) {
        const newJti = randomUUID();
        const updated = await tx.authRefreshSession.updateMany({
          where: {
            id: familyId,
            currentJti: presentedJti,
            revokedAt: null,
          },
          data: {
            currentJti: newJti,
            rotatedAt: new Date(),
          },
        });
        if (updated.count === 1) {
          await tx.authRefreshRotation.create({
            data: {
              sessionId: familyId,
              fromJti: presentedJti,
              toJti: newJti,
            },
          });
          return { familyId, jti: newJti, idempotent: false };
        }
      }

      const prior = await tx.authRefreshRotation.findUnique({
        where: {
          sessionId_fromJti: {
            sessionId: familyId,
            fromJti: presentedJti,
          },
        },
      });
      if (prior) {
        return { familyId, jti: prior.toJti, idempotent: true };
      }

      await this.revokeAllSessionsForUserTx(tx, userId, { bumpTokenVersion: true });
      throw new UnauthorizedException(
        'Refresh token reuse detected. All sessions have been invalidated. Please log in again.',
      );
    });
  }

  async revokeAllSessionsForUser(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.revokeAllSessionsForUserTx(tx, userId, { bumpTokenVersion: false });
    });
  }

  async invalidateUserSessions(userId: string): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const next = await this.revokeAllSessionsForUserTx(tx, userId, { bumpTokenVersion: true });
      return next;
    });
  }

  private async revokeAllSessionsForUserTx(
    tx: Prisma.TransactionClient,
    userId: string,
    opts: { bumpTokenVersion: boolean },
  ): Promise<number> {
    const now = new Date();
    await tx.authRefreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });

    if (!opts.bumpTokenVersion) {
      return (await tx.user.findUnique({ where: { id: userId }, select: { tokenVersion: true } }))
        ?.tokenVersion ?? 0;
    }

    const updated = await tx.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 }, lastActivityAt: now },
      select: { tokenVersion: true },
    });
    return updated.tokenVersion;
  }

  private async lockSessionRow(tx: Prisma.TransactionClient, familyId: string): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT id FROM auth_refresh_sessions WHERE id = ${familyId}::uuid FOR UPDATE`,
    );
    if (rows.length === 0) {
      throw new UnauthorizedException('Session is no longer valid.');
    }
  }
}
