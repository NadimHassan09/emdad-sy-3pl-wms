"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWarehouseOperator = isWarehouseOperator;
exports.isInternalAdmin = isInternalAdmin;
exports.canManageWarehouseUsers = canManageWarehouseUsers;
exports.assertInternalAdmin = assertInternalAdmin;
exports.assertCanManageTargetRole = assertCanManageTargetRole;
exports.assertCanCreateTargetRole = assertCanCreateTargetRole;
exports.assertCanEditExistingUser = assertCanEditExistingUser;
exports.assertCanSetOtherUserPassword = assertCanSetOtherUserPassword;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const rbac_policy_1 = require("./rbac-policy");
function isWarehouseOperator(role) {
    return role === client_1.UserRole.wh_operator;
}
function isInternalAdmin(role) {
    return (0, rbac_policy_1.isInternalAdminRole)(role);
}
function canManageWarehouseUsers(role) {
    return isInternalAdmin(role);
}
function assertInternalAdmin(actor, message) {
    if (!isInternalAdmin(actor.role)) {
        throw new common_1.ForbiddenException(message ?? 'This action requires warehouse manager or super admin access.');
    }
}
function assertCanManageTargetRole(actor, targetRole, message) {
    assertInternalAdmin(actor);
    if (!(0, rbac_policy_1.canManageTargetRole)(actor.role, targetRole)) {
        throw new common_1.ForbiddenException(message ?? 'You cannot manage an account with an equal or higher role.');
    }
}
function assertCanCreateTargetRole(actor, targetRole, message) {
    assertInternalAdmin(actor);
    if (!(0, rbac_policy_1.canCreateTargetRole)(actor.role, targetRole)) {
        throw new common_1.ForbiddenException(message ?? 'You cannot create an account with an equal or higher role.');
    }
}
function assertCanEditExistingUser(actor) {
    assertInternalAdmin(actor);
    if (!(0, rbac_policy_1.canEditExistingUsers)(actor.role)) {
        throw new common_1.ForbiddenException('Only a super admin can edit an existing user account. Admins may create users only.');
    }
}
function assertCanSetOtherUserPassword(actor) {
    assertInternalAdmin(actor);
    if (!(0, rbac_policy_1.canSetOtherUserPassword)(actor.role)) {
        throw new common_1.ForbiddenException('Only a super admin can change another user’s password.');
    }
}
//# sourceMappingURL=internal-rbac.js.map