"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readCompanyIdFilter = readCompanyIdFilter;
function readCompanyIdFilter(companyAccess, user, queryCompanyId) {
    return companyAccess.getReadFilterCompanyId(user, queryCompanyId);
}
//# sourceMappingURL=company-read-scope.js.map