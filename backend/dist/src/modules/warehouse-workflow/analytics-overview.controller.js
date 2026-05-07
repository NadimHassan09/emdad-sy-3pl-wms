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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsOverviewController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const prisma_service_1 = require("../../common/prisma/prisma.service");
let AnalyticsOverviewController = class AnalyticsOverviewController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async overview(user, warehouseId, daysRaw) {
        if (!user.companyId) {
            throw new common_1.BadRequestException('company context required');
        }
        const days = Math.min(Number(daysRaw ?? '7') || 7, 90);
        const from = new Date();
        from.setDate(from.getDate() - days);
        const whFilter = warehouseId
            ? client_1.Prisma.sql `AND warehouse_id = ${warehouseId}::uuid`
            : client_1.Prisma.empty;
        const grouped = await this.prisma.$queryRaw(client_1.Prisma.sql `
      SELECT task_type, COUNT(*)::bigint AS completions
      FROM v_analytics_wh_task_completed_rows
      WHERE company_id = ${user.companyId}::uuid
        AND completed_at >= ${from}
        ${whFilter}
      GROUP BY task_type
      ORDER BY task_type
    `);
        const stats = await this.prisma.$queryRaw(client_1.Prisma.sql `
      SELECT
        percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_minutes)::float8 AS median_minutes,
        COUNT(*)::bigint AS cycle_samples
      FROM v_analytics_wh_task_completed_rows
      WHERE company_id = ${user.companyId}::uuid
        AND completed_at >= ${from}
        ${whFilter}
        AND duration_minutes IS NOT NULL
        AND duration_minutes >= 0
    `);
        const row = stats[0];
        const medianCycleMinutes = row?.median_minutes != null && Number.isFinite(row.median_minutes) ? row.median_minutes : null;
        const cycleSamplesUsed = Number(row?.cycle_samples ?? 0);
        const windowDaysEff = Math.max(days, 0.001);
        const throughputPerDay = cycleSamplesUsed / windowDaysEff;
        return {
            windowDays: days,
            medianCycleMinutes,
            throughputPerDayEstimated: Math.round(throughputPerDay * 1000) / 1000,
            cycleSamplesUsed,
            completedByTaskType: grouped.map((r) => ({
                taskType: r.task_type,
                completions: Number(r.completions),
            })),
        };
    }
};
exports.AnalyticsOverviewController = AnalyticsOverviewController;
__decorate([
    (0, common_1.Get)('overview'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('warehouse_id')),
    __param(2, (0, common_1.Query)('days')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsOverviewController.prototype, "overview", null);
exports.AnalyticsOverviewController = AnalyticsOverviewController = __decorate([
    (0, common_1.Controller)('analytics'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AnalyticsOverviewController);
//# sourceMappingURL=analytics-overview.controller.js.map