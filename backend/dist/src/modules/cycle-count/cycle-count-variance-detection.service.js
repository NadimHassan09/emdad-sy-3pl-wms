"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CycleCountVarianceDetectionService = void 0;
const common_1 = require("@nestjs/common");
const cycle_count_discrepancy_util_1 = require("./cycle-count-discrepancy.util");
let CycleCountVarianceDetectionService = class CycleCountVarianceDetectionService {
    async detectFromCount(tx, cycleCountId) {
        const count = await tx.cycleCount.findUnique({
            where: { id: cycleCountId },
            select: { id: true, companyId: true, warehouseId: true },
        });
        if (!count)
            return 0;
        const lines = await tx.cycleCountLine.findMany({
            where: {
                cycleCountId,
                status: 'counted',
                actualQuantity: { not: null },
                discrepancyQuantity: { not: null },
                variance: null,
            },
            select: {
                id: true,
                productId: true,
                locationId: true,
                lotId: true,
                expectedQuantity: true,
                actualQuantity: true,
                discrepancyQuantity: true,
            },
        });
        let created = 0;
        const now = new Date();
        for (const line of lines) {
            const disc = line.discrepancyQuantity;
            if (!(0, cycle_count_discrepancy_util_1.hasCycleCountDiscrepancy)(disc))
                continue;
            if (line.actualQuantity == null)
                continue;
            await tx.cycleCountVariance.create({
                data: {
                    cycleCountId: count.id,
                    cycleCountLineId: line.id,
                    companyId: count.companyId,
                    warehouseId: count.warehouseId,
                    productId: line.productId,
                    locationId: line.locationId,
                    lotId: line.lotId,
                    expectedQuantity: line.expectedQuantity,
                    actualQuantity: line.actualQuantity,
                    discrepancyQuantity: disc,
                    updatedAt: now,
                },
            });
            created += 1;
        }
        return created;
    }
};
exports.CycleCountVarianceDetectionService = CycleCountVarianceDetectionService;
exports.CycleCountVarianceDetectionService = CycleCountVarianceDetectionService = __decorate([
    (0, common_1.Injectable)()
], CycleCountVarianceDetectionService);
//# sourceMappingURL=cycle-count-variance-detection.service.js.map