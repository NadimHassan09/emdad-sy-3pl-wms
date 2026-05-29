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
exports.AuditLogPolicyConfig = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let AuditLogPolicyConfig = class AuditLogPolicyConfig {
    config;
    retentionDays;
    queryMaxLimit;
    queryMaxOffset;
    queryMaxDateRangeDays;
    queryDefaultWindowDays;
    queryCountCap;
    exportMaxRows;
    exportMaxDateRangeDays;
    exportEnabled;
    constructor(config) {
        this.config = config;
        this.retentionDays = this.readInt('AUDIT_RETENTION_DAYS', 730, 0, 3650);
        this.queryMaxLimit = this.readInt('AUDIT_QUERY_MAX_LIMIT', 100, 1, 100);
        this.queryMaxOffset = this.readInt('AUDIT_QUERY_MAX_OFFSET', 5000, 0, 50_000);
        this.queryMaxDateRangeDays = this.readInt('AUDIT_QUERY_MAX_DATE_RANGE_DAYS', 366, 1, 366);
        this.queryDefaultWindowDays = this.readInt('AUDIT_QUERY_DEFAULT_WINDOW_DAYS', 30, 1, 366);
        this.queryCountCap = this.readInt('AUDIT_QUERY_COUNT_CAP', 10_000, 100, 1_000_000);
        this.exportMaxRows = this.readInt('AUDIT_EXPORT_MAX_ROWS', 500, 1, 5000);
        this.exportMaxDateRangeDays = this.readInt('AUDIT_EXPORT_MAX_DATE_RANGE_DAYS', 90, 1, 366);
        this.exportEnabled = this.readBool('AUDIT_EXPORT_ENABLED', true);
    }
    retentionCutoffDate(now = new Date()) {
        if (this.retentionDays <= 0)
            return null;
        return new Date(now.getTime() - this.retentionDays * 86400_000);
    }
    snapshot(now = new Date()) {
        const cutoff = this.retentionCutoffDate(now);
        return {
            retentionDays: this.retentionDays,
            retentionCutoffIso: cutoff?.toISOString() ?? '',
            queryMaxLimit: this.queryMaxLimit,
            queryMaxOffset: this.queryMaxOffset,
            queryMaxDateRangeDays: this.queryMaxDateRangeDays,
            queryDefaultWindowDays: this.queryDefaultWindowDays,
            queryCountCap: this.queryCountCap,
            exportMaxRows: this.exportMaxRows,
            exportMaxDateRangeDays: this.exportMaxDateRangeDays,
            exportEnabled: this.exportEnabled,
        };
    }
    readInt(key, fallback, min, max) {
        const raw = this.config.get(key);
        if (raw === undefined || raw === '')
            return fallback;
        const n = parseInt(String(raw).trim(), 10);
        if (!Number.isFinite(n))
            return fallback;
        return Math.min(Math.max(n, min), max);
    }
    readBool(key, fallback) {
        const raw = (this.config.get(key) ?? '').trim().toLowerCase();
        if (!raw)
            return fallback;
        if (['1', 'true', 'yes', 'on'].includes(raw))
            return true;
        if (['0', 'false', 'no', 'off'].includes(raw))
            return false;
        return fallback;
    }
};
exports.AuditLogPolicyConfig = AuditLogPolicyConfig;
exports.AuditLogPolicyConfig = AuditLogPolicyConfig = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AuditLogPolicyConfig);
//# sourceMappingURL=audit-log-policy.config.js.map