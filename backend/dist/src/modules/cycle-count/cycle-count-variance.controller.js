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
exports.CycleCountVarianceController = void 0;
const common_1 = require("@nestjs/common");
const internal_admin_guard_1 = require("../../common/auth/internal-admin.guard");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const parse_uuid_loose_pipe_1 = require("../../common/pipes/parse-uuid-loose.pipe");
const cycle_count_variance_service_1 = require("./cycle-count-variance.service");
const variance_dto_1 = require("./dto/variance.dto");
let CycleCountVarianceController = class CycleCountVarianceController {
    variances;
    constructor(variances) {
        this.variances = variances;
    }
    listReasonCodes() {
        return this.variances.listReasonCodes();
    }
    list(user, query) {
        return this.variances.list(user, query);
    }
    findOne(user, id) {
        return this.variances.findById(user, id);
    }
    review(user, id, dto) {
        return this.variances.review(user, id, dto);
    }
};
exports.CycleCountVarianceController = CycleCountVarianceController;
__decorate([
    (0, common_1.Get)('reason-codes'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CycleCountVarianceController.prototype, "listReasonCodes", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, variance_dto_1.ListVariancesQueryDto]),
    __metadata("design:returntype", void 0)
], CycleCountVarianceController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CycleCountVarianceController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id/review'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, variance_dto_1.ReviewVarianceDto]),
    __metadata("design:returntype", void 0)
], CycleCountVarianceController.prototype, "review", null);
exports.CycleCountVarianceController = CycleCountVarianceController = __decorate([
    (0, common_1.Controller)('cycle-count/variances'),
    __metadata("design:paramtypes", [cycle_count_variance_service_1.CycleCountVarianceService])
], CycleCountVarianceController);
//# sourceMappingURL=cycle-count-variance.controller.js.map