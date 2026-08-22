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
exports.BillingUsageService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma/prisma.service");
let BillingUsageService = class BillingUsageService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getCompanyUsage(companyId) {
        const rows = await this.prisma.$queryRaw `
      SELECT
        COALESCE(
          SUM(GREATEST(cs.quantity_on_hand, 0) * COALESCE(p.volume_cbm, 0)),
          0
        )::text AS volume,
        COALESCE(
          SUM(GREATEST(cs.quantity_on_hand, 0) * COALESCE(p.weight_kg, 0)),
          0
        )::text AS weight
      FROM current_stock cs
      INNER JOIN products p ON p.id = cs.product_id
      WHERE cs.company_id = ${companyId}::uuid
        AND cs.quantity_on_hand > 0
        AND p.status <> 'archived'::product_status
    `;
        const row = rows[0];
        return {
            volumeCbm: new client_1.Prisma.Decimal(row?.volume ?? '0'),
            weightKg: new client_1.Prisma.Decimal(row?.weight ?? '0'),
        };
    }
    async getSystemUsedStorageCbm() {
        const rows = await this.prisma.$queryRaw `
      SELECT
        COALESCE(
          SUM(GREATEST(cs.quantity_on_hand, 0) * COALESCE(p.volume_cbm, 0)),
          0
        )::text AS volume
      FROM current_stock cs
      INNER JOIN products p ON p.id = cs.product_id
      WHERE cs.quantity_on_hand > 0
        AND p.status <> 'archived'::product_status
    `;
        return new client_1.Prisma.Decimal(rows[0]?.volume ?? '0');
    }
    async getSystemReservedStorageCbm() {
        const agg = await this.prisma.billingPlan.aggregate({
            where: { active: true },
            _sum: { reservedVolume: true },
        });
        return agg._sum.reservedVolume ?? new client_1.Prisma.Decimal(0);
    }
    async getCompanyReservedStorageCbm(companyId) {
        const plan = await this.prisma.billingPlan.findFirst({
            where: { companyId, active: true },
            select: { reservedVolume: true },
            orderBy: { updatedAt: 'desc' },
        });
        return plan?.reservedVolume ?? new client_1.Prisma.Decimal(0);
    }
    buildUtilizationSnapshot(used, reserved) {
        const usedSafe = client_1.Prisma.Decimal.max(used, new client_1.Prisma.Decimal(0));
        const reservedSafe = client_1.Prisma.Decimal.max(reserved, new client_1.Prisma.Decimal(0));
        const remaining = client_1.Prisma.Decimal.max(reservedSafe.sub(usedSafe), new client_1.Prisma.Decimal(0));
        let storageUsagePercent = 0;
        if (reservedSafe.gt(0)) {
            storageUsagePercent = Math.min(100, Math.round(Number(usedSafe.div(reservedSafe).mul(1000))) / 10);
            if (!Number.isFinite(storageUsagePercent) || storageUsagePercent < 0) {
                storageUsagePercent = 0;
            }
        }
        return {
            usedStorageCbm: usedSafe,
            reservedStorageCbm: reservedSafe,
            remainingStorageCbm: remaining,
            storageUsagePercent,
        };
    }
    async getCompanyStorageSnapshot(companyId) {
        const [usage, reserved] = await Promise.all([
            this.getCompanyUsage(companyId),
            this.getCompanyReservedStorageCbm(companyId),
        ]);
        return this.buildUtilizationSnapshot(usage.volumeCbm, reserved);
    }
    async getSystemStorageSnapshot() {
        const [used, reserved] = await Promise.all([
            this.getSystemUsedStorageCbm(),
            this.getSystemReservedStorageCbm(),
        ]);
        return this.buildUtilizationSnapshot(used, reserved);
    }
};
exports.BillingUsageService = BillingUsageService;
exports.BillingUsageService = BillingUsageService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BillingUsageService);
//# sourceMappingURL=billing-usage.service.js.map