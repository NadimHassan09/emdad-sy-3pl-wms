"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIENT_PORTAL_LOGIN_ALLOWED = void 0;
exports.mapCompanyToAccountStatus = mapCompanyToAccountStatus;
exports.assertClientPortalAccountAccess = assertClientPortalAccountAccess;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
exports.CLIENT_PORTAL_LOGIN_ALLOWED = [
    client_1.CompanyStatus.active,
    client_1.CompanyStatus.restricted,
];
function mapCompanyToAccountStatus(status) {
    if (status === client_1.CompanyStatus.active || status === client_1.CompanyStatus.restricted) {
        return 'active';
    }
    if (status === client_1.CompanyStatus.suspended) {
        return 'suspended';
    }
    return 'inactive';
}
function assertClientPortalAccountAccess(status) {
    if (!status) {
        throw new common_1.ForbiddenException('Your account is currently inactive. Please contact support for assistance.');
    }
    if (status === client_1.CompanyStatus.active || status === client_1.CompanyStatus.restricted) {
        return;
    }
    if (status === client_1.CompanyStatus.suspended) {
        throw new common_1.ForbiddenException('Your account is currently suspended. Please contact support.');
    }
    throw new common_1.ForbiddenException('Your account is currently inactive. Please contact support for assistance.');
}
//# sourceMappingURL=client-portal-account-access.js.map