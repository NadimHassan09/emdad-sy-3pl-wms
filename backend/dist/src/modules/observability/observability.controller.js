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
exports.ObservabilityController = void 0;
const common_1 = require("@nestjs/common");
const internal_admin_guard_1 = require("../../common/auth/internal-admin.guard");
const public_decorator_1 = require("../../common/auth/public.decorator");
const observability_service_1 = require("./observability.service");
const ops_policy_config_1 = require("./ops-policy.config");
const ops_probe_guard_1 = require("./ops-probe.guard");
let ObservabilityController = class ObservabilityController {
    observability;
    policy;
    constructor(observability, policy) {
        this.observability = observability;
        this.policy = policy;
    }
    live() {
        this.observability.assertLivenessEnabled();
        return this.observability.live();
    }
    async ready() {
        this.observability.assertReadinessEnabled();
        return this.observability.ready();
    }
    diagnostics(req) {
        this.observability.assertDiagnosticsEnabled();
        return this.observability.diagnostics(req);
    }
    getPolicy() {
        return this.policy.snapshot();
    }
};
exports.ObservabilityController = ObservabilityController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('health/live'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ObservabilityController.prototype, "live", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(ops_probe_guard_1.OpsProbeGuard),
    (0, common_1.Get)('health/ready'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ObservabilityController.prototype, "ready", null);
__decorate([
    (0, common_1.Get)('diagnostics'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ObservabilityController.prototype, "diagnostics", null);
__decorate([
    (0, common_1.Get)('policy'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ObservabilityController.prototype, "getPolicy", null);
exports.ObservabilityController = ObservabilityController = __decorate([
    (0, common_1.Controller)('ops'),
    __metadata("design:paramtypes", [observability_service_1.ObservabilityService,
        ops_policy_config_1.OpsPolicyConfig])
], ObservabilityController);
//# sourceMappingURL=observability.controller.js.map