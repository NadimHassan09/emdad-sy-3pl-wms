"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TENANT_SCOPE_REQUIRED_MESSAGE = exports.ROLE_RANK = exports.AUTH_GROUP_ADMIN_ROLES = exports.INTERNAL_ADMIN_ROLES = void 0;
exports.isInternalAdminRole = isInternalAdminRole;
exports.roleRank = roleRank;
exports.canManageTargetRole = canManageTargetRole;
exports.canCreateTargetRole = canCreateTargetRole;
exports.canEditExistingUsers = canEditExistingUsers;
exports.canSetOtherUserPassword = canSetOtherUserPassword;
exports.roleToAuthGroup = roleToAuthGroup;
const client_1 = require("@prisma/client");
const auth_groups_1 = require("./auth-groups");
exports.INTERNAL_ADMIN_ROLES = [client_1.UserRole.super_admin, client_1.UserRole.wh_manager];
exports.AUTH_GROUP_ADMIN_ROLES = [
    client_1.UserRole.super_admin,
    client_1.UserRole.wh_manager,
    client_1.UserRole.finance,
];
exports.ROLE_RANK = {
    [client_1.UserRole.super_admin]: 100,
    [client_1.UserRole.wh_manager]: 80,
    [client_1.UserRole.finance]: 60,
    [client_1.UserRole.viewer]: 55,
    [client_1.UserRole.inventory_controller]: 50,
    [client_1.UserRole.wh_operator]: 40,
    [client_1.UserRole.client_admin]: 30,
    [client_1.UserRole.client_staff]: 20,
};
function isInternalAdminRole(role) {
    return role === client_1.UserRole.super_admin || role === client_1.UserRole.wh_manager;
}
function roleRank(role) {
    if (role in exports.ROLE_RANK) {
        return exports.ROLE_RANK[role];
    }
    return 0;
}
function canManageTargetRole(actorRole, targetRole) {
    return roleRank(actorRole) > roleRank(targetRole);
}
function canCreateTargetRole(actorRole, targetRole) {
    if (actorRole === client_1.UserRole.super_admin && targetRole === client_1.UserRole.super_admin) {
        return true;
    }
    return canManageTargetRole(actorRole, targetRole);
}
function canEditExistingUsers(actorRole) {
    return actorRole === client_1.UserRole.super_admin;
}
function canSetOtherUserPassword(actorRole) {
    return actorRole === client_1.UserRole.super_admin;
}
function roleToAuthGroup(role) {
    return (0, auth_groups_1.userRoleToAuthGroup)(role);
}
exports.TENANT_SCOPE_REQUIRED_MESSAGE = 'Select a client tenant (X-Company-Id header or companyId query parameter) to access tenant-scoped data.';
//# sourceMappingURL=rbac-policy.js.map