"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readCompanyIdFilter = readCompanyIdFilter;
exports.readCompanyIdFilterRequired = readCompanyIdFilterRequired;
function readCompanyIdFilter(companyAccess, user, queryCompanyId) {
    return companyAccess.getReadFilterCompanyId(user, queryCompanyId);
}
function readCompanyIdFilterRequired(companyAccess, user, queryCompanyId) {
    return companyAccess.requireReadTenantScope(user, queryCompanyId);
}
//# sourceMappingURL=company-read-scope.js.map