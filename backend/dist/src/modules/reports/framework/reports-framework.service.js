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
exports.ReportsFrameworkService = void 0;
const common_1 = require("@nestjs/common");
const reports_cache_service_1 = require("../reports-cache.service");
const reports_policy_config_1 = require("../reports-policy.config");
const report_filters_util_1 = require("./report-filters.util");
const report_permissions_util_1 = require("./report-permissions.util");
const report_registry_config_1 = require("./report-registry.config");
let ReportsFrameworkService = class ReportsFrameworkService {
    cache;
    policy;
    constructor(cache, policy) {
        this.cache = cache;
        this.policy = policy;
    }
    resolveDefinition(reportId) {
        const def = (0, report_registry_config_1.getReportDefinition)(reportId);
        if (!def) {
            throw new common_1.BadRequestException(`Unknown report: ${reportId}`);
        }
        return def;
    }
    assertAccess(user, reportId) {
        (0, report_permissions_util_1.assertReportAccess)(user, reportId);
    }
    prepareQuery(user, reportId, query) {
        this.assertAccess(user, reportId);
        const def = this.resolveDefinition(reportId);
        const normalized = (0, report_filters_util_1.normalizeReportQuery)(query);
        (0, report_filters_util_1.validateReportFilters)(def, normalized);
        this.validatePagination(normalized);
        return normalized;
    }
    async runCached(user, reportId, query, namespace, loader, extraCacheKey = {}) {
        const prepared = this.prepareQuery(user, reportId, query);
        const cachePayload = { reportId, query: prepared, userId: user.id, ...extraCacheKey };
        const cached = await this.cache.get(namespace, cachePayload);
        if (cached)
            return { ...cached, cached: true };
        const result = await loader();
        await this.cache.set(namespace, cachePayload, result);
        return { ...result, cached: false };
    }
    exportColumnsFor(reportId) {
        return this.resolveDefinition(reportId).exportColumns;
    }
    async getOrSetCache(namespace, payload, loader) {
        const cached = await this.cache.get(namespace, payload);
        if (cached)
            return { value: cached, cached: true };
        const value = await loader();
        await this.cache.set(namespace, payload, value);
        return { value, cached: false };
    }
    validatePagination(query) {
        if (query.limit > this.policy.previewMaxLimit) {
            throw new common_1.BadRequestException(`limit may not exceed ${this.policy.previewMaxLimit}.`);
        }
        if (query.offset > this.policy.previewMaxOffset) {
            throw new common_1.BadRequestException(`offset may not exceed ${this.policy.previewMaxOffset}.`);
        }
    }
};
exports.ReportsFrameworkService = ReportsFrameworkService;
exports.ReportsFrameworkService = ReportsFrameworkService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [reports_cache_service_1.ReportsCacheService,
        reports_policy_config_1.ReportsPolicyConfig])
], ReportsFrameworkService);
//# sourceMappingURL=reports-framework.service.js.map