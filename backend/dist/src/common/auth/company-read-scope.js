"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readCompanyIdFilter = readCompanyIdFilter;
const INTERNAL_WMS_ROLES = new Set([
    'super_admin',
    'wh_manager',
    'wh_operator',
    'finance',
]);
function readCompanyIdFilter(user, queryCompanyId) {
    const q = queryCompanyId?.trim();
    if (q)
        return q;
    if (INTERNAL_WMS_ROLES.has(user.role))
        return undefined;
    return user.companyId ?? undefined;
}
//# sourceMappingURL=company-read-scope.js.map