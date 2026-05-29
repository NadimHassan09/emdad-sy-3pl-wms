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
exports.CycleCountSnapshotService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const cycle_count_constants_1 = require("./cycle-count.constants");
let CycleCountSnapshotService = class CycleCountSnapshotService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async buildSnapshotRows(tx, opts) {
        const rows = await tx.currentStock.findMany({
            where: {
                companyId: opts.companyId,
                warehouseId: opts.warehouseId,
                packageId: null,
                ...(opts.productIds?.length ? { productId: { in: opts.productIds } } : {}),
                ...(opts.includeZeroOnHand ? {} : { quantityOnHand: { gt: 0 } }),
                location: { type: { in: cycle_count_constants_1.CYCLE_COUNT_LOCATION_TYPES } },
            },
            select: {
                productId: true,
                locationId: true,
                lotId: true,
                quantityOnHand: true,
            },
            orderBy: [{ productId: 'asc' }, { locationId: 'asc' }, { lotId: 'asc' }],
        });
        const seen = new Set();
        const out = [];
        for (const r of rows) {
            const key = `${r.productId}:${r.locationId}:${r.lotId ?? 'null'}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            out.push({
                productId: r.productId,
                locationId: r.locationId,
                lotId: r.lotId,
                expectedQuantity: r.quantityOnHand,
            });
        }
        return out;
    }
    async insertLines(tx, cycleCountId, rows, defaultAssignedWorkerId) {
        if (rows.length === 0)
            return 0;
        const result = await tx.cycleCountLine.createMany({
            data: rows.map((r) => ({
                cycleCountId,
                productId: r.productId,
                locationId: r.locationId,
                lotId: r.lotId,
                expectedQuantity: r.expectedQuantity,
                assignedWorkerId: defaultAssignedWorkerId ?? undefined,
            })),
            skipDuplicates: true,
        });
        return result.count;
    }
};
exports.CycleCountSnapshotService = CycleCountSnapshotService;
exports.CycleCountSnapshotService = CycleCountSnapshotService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CycleCountSnapshotService);
//# sourceMappingURL=cycle-count-snapshot.service.js.map