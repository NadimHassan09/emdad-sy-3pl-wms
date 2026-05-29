"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObservabilityModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const prisma_module_1 = require("../../common/prisma/prisma.module");
const redis_module_1 = require("../../common/redis/redis.module");
const observability_controller_1 = require("./observability.controller");
const observability_service_1 = require("./observability.service");
const ops_policy_config_1 = require("./ops-policy.config");
const ops_probe_guard_1 = require("./ops-probe.guard");
let ObservabilityModule = class ObservabilityModule {
};
exports.ObservabilityModule = ObservabilityModule;
exports.ObservabilityModule = ObservabilityModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, redis_module_1.RedisModule, auth_module_1.AuthModule],
        controllers: [observability_controller_1.ObservabilityController],
        providers: [ops_policy_config_1.OpsPolicyConfig, ops_probe_guard_1.OpsProbeGuard, observability_service_1.ObservabilityService],
        exports: [ops_policy_config_1.OpsPolicyConfig, observability_service_1.ObservabilityService],
    })
], ObservabilityModule);
//# sourceMappingURL=observability.module.js.map