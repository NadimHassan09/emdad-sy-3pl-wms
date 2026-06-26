"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateReportFilters = validateReportFilters;
exports.normalizeReportQuery = normalizeReportQuery;
const common_1 = require("@nestjs/common");
const DAY = /^\d{4}-\d{2}-\d{2}$/;
function validateReportFilters(def, query) {
    if (def.requiresWarehouse && !query.warehouseId?.trim()) {
        throw new common_1.BadRequestException('warehouseId is required for this report.');
    }
    if (def.filterKeys.includes('dateRange')) {
        if (query.dateFrom && !DAY.test(query.dateFrom)) {
            throw new common_1.BadRequestException('dateFrom must be YYYY-MM-DD.');
        }
        if (query.dateTo && !DAY.test(query.dateTo)) {
            throw new common_1.BadRequestException('dateTo must be YYYY-MM-DD.');
        }
        if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo) {
            throw new common_1.BadRequestException('dateFrom must be on or before dateTo.');
        }
    }
    if (!def.filterKeys.includes('status') && query.status?.trim()) {
        throw new common_1.BadRequestException('status filter is not supported for this report.');
    }
    if (!def.filterKeys.includes('sku') && query.sku?.trim()) {
        throw new common_1.BadRequestException('sku filter is not supported for this report.');
    }
}
function normalizeReportQuery(query) {
    return {
        ...query,
        warehouseId: query.warehouseId?.trim() || undefined,
        companyId: query.companyId?.trim() || undefined,
        status: query.status?.trim() || undefined,
        sku: query.sku?.trim() || undefined,
        dateFrom: query.dateFrom?.trim() || undefined,
        dateTo: query.dateTo?.trim() || undefined,
        groupBy: query.groupBy?.trim() || undefined,
    };
}
//# sourceMappingURL=report-filters.util.js.map