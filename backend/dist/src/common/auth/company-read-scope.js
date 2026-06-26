"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readCompanyIdFilter = readCompanyIdFilter;
exports.readCompanyIdCatalogFilter = readCompanyIdCatalogFilter;
exports.readCompanyIdFilterRequired = readCompanyIdFilterRequired;
function readCompanyIdFilter(companyAccess, user, queryCompanyId) {
    return companyAccess.getReadFilterCompanyId(user, queryCompanyId);
}
function readCompanyIdCatalogFilter(companyAccess, user, queryCompanyId) {
    const explicit = queryCompanyId?.trim();
    if (explicit) {
        companyAccess.assertCompanyAccess(user, explicit);
        return explicit;
    }
    if (user.tenantScope === 'all') {
        return undefined;
    }
    return companyAccess.requireReadTenantScope(user);
}
function readCompanyIdFilterRequired(companyAccess, user, queryCompanyId) {
    return companyAccess.requireReadTenantScope(user, queryCompanyId);
}
//# sourceMappingURL=company-read-scope.js.map