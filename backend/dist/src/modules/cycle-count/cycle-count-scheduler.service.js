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
var CycleCountSchedulerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CycleCountSchedulerService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const cycle_count_service_1 = require("./cycle-count.service");
let CycleCountSchedulerService = CycleCountSchedulerService_1 = class CycleCountSchedulerService {
    prisma;
    cycleCounts;
    log = new common_1.Logger(CycleCountSchedulerService_1.name);
    systemUserId = null;
    constructor(prisma, cycleCounts) {
        this.prisma = prisma;
        this.cycleCounts = cycleCounts;
    }
    async onModuleInit() {
        await this.resolveSystemUser();
    }
    async tick() {
        try {
            const actorId = await this.resolveSystemUser();
            if (!actorId) {
                this.log.warn('Skipping cycle count scheduler — no system user available.');
                return;
            }
            const n = await this.cycleCounts.runDueSchedules(actorId);
            if (n > 0)
                this.log.log(`Generated ${n} scheduled cycle count(s).`);
        }
        catch (err) {
            this.log.error('Cycle count scheduler tick failed', err);
        }
    }
    async resolveSystemUser() {
        if (this.systemUserId)
            return this.systemUserId;
        const user = await this.prisma.user.findFirst({
            where: {
                role: { in: [client_1.UserRole.super_admin, client_1.UserRole.wh_manager] },
                status: 'active',
            },
            orderBy: { createdAt: 'asc' },
            select: { id: true },
        });
        this.systemUserId = user?.id ?? null;
        return this.systemUserId;
    }
};
exports.CycleCountSchedulerService = CycleCountSchedulerService;
__decorate([
    (0, schedule_1.Cron)('0 3 * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CycleCountSchedulerService.prototype, "tick", null);
exports.CycleCountSchedulerService = CycleCountSchedulerService = CycleCountSchedulerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cycle_count_service_1.CycleCountService])
], CycleCountSchedulerService);
//# sourceMappingURL=cycle-count-scheduler.service.js.map