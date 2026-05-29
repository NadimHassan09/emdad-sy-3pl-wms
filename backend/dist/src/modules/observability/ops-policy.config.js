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
exports.OpsPolicyConfig = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
function readBool(config, key, defaultValue) {
    const raw = (config.get(key) ?? '').trim().toLowerCase();
    if (!raw)
        return defaultValue;
    if (raw === 'false' || raw === '0' || raw === 'no' || raw === 'off')
        return false;
    if (raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on')
        return true;
    return defaultValue;
}
let OpsPolicyConfig = class OpsPolicyConfig {
    isProduction;
    livenessEnabled;
    readinessEnabled;
    readinessVerbose;
    readinessRequiresProbeKey;
    probeSecret;
    diagnosticsEnabled;
    constructor(config) {
        this.isProduction = config.get('NODE_ENV') === 'production';
        this.livenessEnabled = readBool(config, 'OPS_LIVENESS_ENABLED', true);
        this.readinessEnabled = readBool(config, 'OPS_READINESS_ENABLED', true);
        this.probeSecret = (config.get('OPS_PROBE_SECRET') ?? '').trim() || null;
        this.readinessVerbose = readBool(config, 'OPS_READY_VERBOSE', !this.isProduction);
        this.readinessRequiresProbeKey =
            this.isProduction && this.probeSecret !== null && this.probeSecret.length >= 16;
        const diagExplicit = config.get('OPS_DIAGNOSTICS_ENABLED');
        if (diagExplicit !== undefined && diagExplicit.trim() !== '') {
            this.diagnosticsEnabled = readBool(config, 'OPS_DIAGNOSTICS_ENABLED', false);
        }
        else {
            this.diagnosticsEnabled = !this.isProduction;
        }
    }
    snapshot() {
        return {
            livenessEnabled: this.livenessEnabled,
            readinessEnabled: this.readinessEnabled,
            readinessVerbose: this.readinessVerbose,
            readinessRequiresProbeKey: this.readinessRequiresProbeKey,
            diagnosticsEnabled: this.diagnosticsEnabled,
            isProduction: this.isProduction,
        };
    }
};
exports.OpsPolicyConfig = OpsPolicyConfig;
exports.OpsPolicyConfig = OpsPolicyConfig = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], OpsPolicyConfig);
//# sourceMappingURL=ops-policy.config.js.map