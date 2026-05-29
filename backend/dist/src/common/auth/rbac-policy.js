"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TENANT_SCOPE_REQUIRED_MESSAGE = exports.AUTH_GROUP_ADMIN_ROLES = exports.INTERNAL_ADMIN_ROLES = void 0;
exports.isInternalAdminRole = isInternalAdminRole;
exports.roleToAuthGroup = roleToAuthGroup;
const client_1 = require("@prisma/client");
const auth_groups_1 = require("./auth-groups");
exports.INTERNAL_ADMIN_ROLES = [client_1.UserRole.super_admin, client_1.UserRole.wh_manager];
exports.AUTH_GROUP_ADMIN_ROLES = [
    client_1.UserRole.super_admin,
    client_1.UserRole.wh_manager,
    client_1.UserRole.finance,
];
function isInternalAdminRole(role) {
    return role === client_1.UserRole.super_admin || role === client_1.UserRole.wh_manager;
}
function roleToAuthGroup(role) {
    return (0, auth_groups_1.userRoleToAuthGroup)(role);
}
exports.TENANT_SCOPE_REQUIRED_MESSAGE = 'Select a client tenant (X-Company-Id header or companyId query parameter) to access tenant-scoped data.';
//# sourceMappingURL=rbac-policy.js.map