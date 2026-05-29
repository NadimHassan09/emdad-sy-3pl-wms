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
exports.CycleCountLineMutationService = void 0;
const common_1 = require("@nestjs/common");
const domain_exceptions_1 = require("../../common/errors/domain-exceptions");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const cycle_count_count_validation_util_1 = require("./cycle-count-count-validation.util");
const cycle_count_discrepancy_util_1 = require("./cycle-count-discrepancy.util");
let CycleCountLineMutationService = class CycleCountLineMutationService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async countLine(tx, opts) {
        const count = await tx.cycleCount.findUnique({
            where: { id: opts.cycleCountId },
            select: { id: true, status: true, warehouseId: true },
        });
        if (!count)
            throw new common_1.NotFoundException('Cycle count not found.');
        if (count.status !== opts.requiredStatus) {
            throw new domain_exceptions_1.InvalidStateException('Cycle count is not in a countable state.');
        }
        const line = await tx.cycleCountLine.findFirst({
            where: { id: opts.lineId, cycleCountId: opts.cycleCountId },
            include: {
                product: { select: { id: true, uom: true } },
                location: { select: { id: true, warehouseId: true } },
            },
        });
        if (!line)
            throw new common_1.NotFoundException('Cycle count line not found.');
        if (line.location.warehouseId !== count.warehouseId) {
            throw new common_1.NotFoundException('Cycle count line not found.');
        }
        const actual = (0, cycle_count_count_validation_util_1.parseActualQuantity)(opts.input.actualQuantity);
        (0, cycle_count_count_validation_util_1.validateActualQuantityForProduct)(line.product.uom, actual);
        const discrepancy = (0, cycle_count_discrepancy_util_1.computeCycleCountDiscrepancy)(line.expectedQuantity, actual);
        const now = new Date();
        const updated = await tx.cycleCountLine.updateMany({
            where: { id: opts.lineId, cycleCountId: opts.cycleCountId, status: 'pending' },
            data: {
                actualQuantity: actual,
                discrepancyQuantity: discrepancy,
                status: 'counted',
                countedBy: opts.userId,
                countedAt: now,
                countNotes: opts.input.countNotes?.trim() || null,
            },
        });
        if (updated.count === 0) {
            throw new common_1.ConflictException('This location was already counted by another session. Refresh and continue.');
        }
    }
    async skipLine(tx, opts) {
        const count = await tx.cycleCount.findUnique({
            where: { id: opts.cycleCountId },
            select: { status: true },
        });
        if (!count)
            throw new common_1.NotFoundException('Cycle count not found.');
        if (count.status !== opts.requiredStatus) {
            throw new domain_exceptions_1.InvalidStateException('Cycle count is not in a countable state.');
        }
        const updated = await tx.cycleCountLine.updateMany({
            where: { id: opts.lineId, cycleCountId: opts.cycleCountId, status: 'pending' },
            data: {
                status: 'skipped',
                countedBy: opts.userId,
                countedAt: new Date(),
                countNotes: opts.countNotes?.trim() || null,
            },
        });
        if (updated.count === 0) {
            throw new common_1.ConflictException('This location was already processed by another session. Refresh and continue.');
        }
    }
};
exports.CycleCountLineMutationService = CycleCountLineMutationService;
exports.CycleCountLineMutationService = CycleCountLineMutationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CycleCountLineMutationService);
//# sourceMappingURL=cycle-count-line-mutation.service.js.map