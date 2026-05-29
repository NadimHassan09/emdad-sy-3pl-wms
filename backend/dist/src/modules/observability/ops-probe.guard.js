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
exports.OpsProbeGuard = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const rbac_policy_1 = require("../../common/auth/rbac-policy");
const ops_policy_config_1 = require("./ops-policy.config");
let OpsProbeGuard = class OpsProbeGuard {
    policy;
    constructor(policy) {
        this.policy = policy;
    }
    canActivate(context) {
        if (!this.policy.readinessRequiresProbeKey) {
            return true;
        }
        const req = context.switchToHttp().getRequest();
        const user = req.user;
        if (user && (0, rbac_policy_1.isInternalAdminRole)(user.role)) {
            return true;
        }
        const provided = this.headerValue(req.headers['x-ops-probe-key']);
        const expected = this.policy.probeSecret;
        if (provided && expected && this.safeEqual(provided, expected)) {
            return true;
        }
        throw new common_1.ForbiddenException('Operational readiness probe requires a valid X-Ops-Probe-Key.');
    }
    headerValue(value) {
        if (!value)
            return null;
        const raw = Array.isArray(value) ? value[0] : value;
        const trimmed = raw?.trim();
        return trimmed || null;
    }
    safeEqual(a, b) {
        const ab = Buffer.from(a);
        const bb = Buffer.from(b);
        if (ab.length !== bb.length)
            return false;
        return (0, node_crypto_1.timingSafeEqual)(ab, bb);
    }
};
exports.OpsProbeGuard = OpsProbeGuard;
exports.OpsProbeGuard = OpsProbeGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ops_policy_config_1.OpsPolicyConfig])
], OpsProbeGuard);
//# sourceMappingURL=ops-probe.guard.js.map