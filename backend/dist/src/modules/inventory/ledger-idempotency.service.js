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
exports.LedgerIdempotencyService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma/prisma.service");
let LedgerIdempotencyService = class LedgerIdempotencyService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async appendIfAbsent(tx, idempotencyKey, data) {
        const existing = await tx.ledgerIdempotency.findUnique({
            where: { idempotencyKey },
        });
        if (existing) {
            return { ledgerId: existing.ledgerId, inserted: false };
        }
        const row = await tx.inventoryLedger.create({
            data: { ...data, idempotencyKey },
        });
        await tx.ledgerIdempotency.create({
            data: {
                idempotencyKey,
                ledgerId: row.id,
            },
        });
        return { ledgerId: row.id, inserted: true };
    }
};
exports.LedgerIdempotencyService = LedgerIdempotencyService;
exports.LedgerIdempotencyService = LedgerIdempotencyService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LedgerIdempotencyService);
//# sourceMappingURL=ledger-idempotency.service.js.map