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
exports.CycleCountController = void 0;
const common_1 = require("@nestjs/common");
const internal_admin_guard_1 = require("../../common/auth/internal-admin.guard");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const parse_uuid_loose_pipe_1 = require("../../common/pipes/parse-uuid-loose.pipe");
const cycle_count_service_1 = require("./cycle-count.service");
const assign_cycle_count_dto_1 = require("./dto/assign-cycle-count.dto");
const assign_cycle_count_line_dto_1 = require("./dto/assign-cycle-count-line.dto");
const create_cycle_count_dto_1 = require("./dto/create-cycle-count.dto");
const list_cycle_counts_query_dto_1 = require("./dto/list-cycle-counts-query.dto");
const list_product_history_query_dto_1 = require("./dto/list-product-history-query.dto");
const skip_cycle_count_line_dto_1 = require("./dto/skip-cycle-count-line.dto");
const submit_line_count_dto_1 = require("./dto/submit-line-count.dto");
const upsert_cycle_count_schedule_dto_1 = require("./dto/upsert-cycle-count-schedule.dto");
const cycle_count_variance_service_1 = require("./cycle-count-variance.service");
let CycleCountController = class CycleCountController {
    cycleCounts;
    variances;
    constructor(cycleCounts, variances) {
        this.cycleCounts = cycleCounts;
        this.variances = variances;
    }
    upsertSchedule(user, dto) {
        return this.cycleCounts.upsertSchedule(user, dto);
    }
    listSchedules(user, companyId) {
        return this.cycleCounts.listSchedules(user, companyId);
    }
    listProductHistory(user, query) {
        return this.cycleCounts.listProductHistory(user, query);
    }
    createCount(user, dto) {
        return this.cycleCounts.createManual(user, dto);
    }
    listCounts(user, query) {
        return this.cycleCounts.list(user, query);
    }
    getCount(user, id) {
        return this.cycleCounts.findById(user, id);
    }
    start(user, id) {
        return this.cycleCounts.start(user, id);
    }
    assignSession(user, id, dto) {
        return this.cycleCounts.assignSession(user, id, dto);
    }
    assignLine(user, id, lineId, dto) {
        return this.cycleCounts.assignLine(user, id, lineId, dto);
    }
    submitLineCount(user, id, lineId, dto) {
        return this.cycleCounts.submitLineCount(user, id, lineId, dto);
    }
    skipLine(user, id, lineId, dto) {
        return this.cycleCounts.skipLine(user, id, lineId, dto);
    }
    submitForReview(user, id) {
        return this.cycleCounts.submitForReview(user, id);
    }
    listCountVariances(user, id) {
        return this.variances.listForCount(user, id);
    }
    listCountAdjustments(user, id) {
        return this.variances.listAdjustmentsForCount(user, id);
    }
    buildReconciliation(user, id) {
        return this.variances.buildReconciliationDraft(user, id);
    }
    postReconciliation(user, id) {
        return this.variances.postReconciliation(user, id);
    }
    complete(user, id) {
        return this.cycleCounts.complete(user, id);
    }
    cancel(user, id) {
        return this.cycleCounts.cancel(user, id);
    }
};
exports.CycleCountController = CycleCountController;
__decorate([
    (0, common_1.Post)('schedules'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, upsert_cycle_count_schedule_dto_1.UpsertCycleCountScheduleDto]),
    __metadata("design:returntype", void 0)
], CycleCountController.prototype, "upsertSchedule", null);
__decorate([
    (0, common_1.Get)('schedules'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('companyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CycleCountController.prototype, "listSchedules", null);
__decorate([
    (0, common_1.Get)('product-history'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_product_history_query_dto_1.ListProductHistoryQueryDto]),
    __metadata("design:returntype", void 0)
], CycleCountController.prototype, "listProductHistory", null);
__decorate([
    (0, common_1.Post)('counts'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_cycle_count_dto_1.CreateCycleCountDto]),
    __metadata("design:returntype", void 0)
], CycleCountController.prototype, "createCount", null);
__decorate([
    (0, common_1.Get)('counts'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_cycle_counts_query_dto_1.ListCycleCountsQueryDto]),
    __metadata("design:returntype", void 0)
], CycleCountController.prototype, "listCounts", null);
__decorate([
    (0, common_1.Get)('counts/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CycleCountController.prototype, "getCount", null);
__decorate([
    (0, common_1.Post)('counts/:id/start'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CycleCountController.prototype, "start", null);
__decorate([
    (0, common_1.Patch)('counts/:id/assign'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, assign_cycle_count_dto_1.AssignCycleCountDto]),
    __metadata("design:returntype", void 0)
], CycleCountController.prototype, "assignSession", null);
__decorate([
    (0, common_1.Patch)('counts/:id/lines/:lineId/assign'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Param)('lineId', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, assign_cycle_count_line_dto_1.AssignCycleCountLineDto]),
    __metadata("design:returntype", void 0)
], CycleCountController.prototype, "assignLine", null);
__decorate([
    (0, common_1.Post)('counts/:id/lines/:lineId/count'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Param)('lineId', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, submit_line_count_dto_1.SubmitLineCountDto]),
    __metadata("design:returntype", void 0)
], CycleCountController.prototype, "submitLineCount", null);
__decorate([
    (0, common_1.Post)('counts/:id/lines/:lineId/skip'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Param)('lineId', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, skip_cycle_count_line_dto_1.SkipCycleCountLineDto]),
    __metadata("design:returntype", void 0)
], CycleCountController.prototype, "skipLine", null);
__decorate([
    (0, common_1.Post)('counts/:id/submit-review'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CycleCountController.prototype, "submitForReview", null);
__decorate([
    (0, common_1.Get)('counts/:id/variances'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CycleCountController.prototype, "listCountVariances", null);
__decorate([
    (0, common_1.Get)('counts/:id/adjustments'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CycleCountController.prototype, "listCountAdjustments", null);
__decorate([
    (0, common_1.Post)('counts/:id/reconcile'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CycleCountController.prototype, "buildReconciliation", null);
__decorate([
    (0, common_1.Post)('counts/:id/post-reconciliation'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CycleCountController.prototype, "postReconciliation", null);
__decorate([
    (0, common_1.Post)('counts/:id/complete'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CycleCountController.prototype, "complete", null);
__decorate([
    (0, common_1.Post)('counts/:id/cancel'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CycleCountController.prototype, "cancel", null);
exports.CycleCountController = CycleCountController = __decorate([
    (0, common_1.Controller)('cycle-count'),
    __metadata("design:paramtypes", [cycle_count_service_1.CycleCountService,
        cycle_count_variance_service_1.CycleCountVarianceService])
], CycleCountController);
//# sourceMappingURL=cycle-count.controller.js.map