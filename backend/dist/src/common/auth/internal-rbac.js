"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWarehouseOperator = isWarehouseOperator;
exports.isInternalAdmin = isInternalAdmin;
exports.canManageWarehouseUsers = canManageWarehouseUsers;
exports.assertInternalAdmin = assertInternalAdmin;
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
//# sourceMappingURL=internal-rbac.js.map