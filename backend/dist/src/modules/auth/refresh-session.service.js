"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefreshSessionService = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma/prisma.service");
let RefreshSessionService = class RefreshSessionService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createSession(userId, tokenVersion, expiresAt) {
        const familyId = (0, node_crypto_1.randomUUID)();
        const jti = (0, node_crypto_1.randomUUID)();
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
    async rotateSession(userId, tokenVersion, familyId, presentedJti) {
        return this.prisma.$transaction(async (tx) => {
            await this.lockSessionRow(tx, familyId);
            const session = await tx.authRefreshSession.findUnique({
                where: { id: familyId },
            });
            if (!session || session.userId !== userId) {
                throw new common_1.UnauthorizedException('Session is no longer valid.');
            }
            if (session.revokedAt) {
                throw new common_1.UnauthorizedException('Session has been invalidated. Please log in again.');
            }
            if (session.expiresAt.getTime() <= Date.now()) {
                throw new common_1.UnauthorizedException('Refresh session has expired. Please log in again.');
            }
            if (session.tokenVersion !== tokenVersion) {
                throw new common_1.UnauthorizedException('Session has been invalidated. Please log in again.');
            }
            if (session.currentJti === presentedJti) {
                const newJti = (0, node_crypto_1.randomUUID)();
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
            throw new common_1.UnauthorizedException('Refresh token reuse detected. All sessions have been invalidated. Please log in again.');
        });
    }
    async revokeAllSessionsForUser(userId) {
        await this.prisma.$transaction(async (tx) => {
            await this.revokeAllSessionsForUserTx(tx, userId, { bumpTokenVersion: false });
        });
    }
    async invalidateUserSessions(userId) {
        return this.prisma.$transaction(async (tx) => {
            const next = await this.revokeAllSessionsForUserTx(tx, userId, { bumpTokenVersion: true });
            return next;
        });
    }
    async revokeAllSessionsForUserTx(tx, userId, opts) {
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
    async lockSessionRow(tx, familyId) {
        const rows = await tx.$queryRaw(client_1.Prisma.sql `SELECT id FROM auth_refresh_sessions WHERE id = ${familyId}::uuid FOR UPDATE`);
        if (rows.length === 0) {
            throw new common_1.UnauthorizedException('Session is no longer valid.');
        }
    }
};
exports.RefreshSessionService = RefreshSessionService;
exports.RefreshSessionService = RefreshSessionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RefreshSessionService);
//# sourceMappingURL=refresh-session.service.js.map