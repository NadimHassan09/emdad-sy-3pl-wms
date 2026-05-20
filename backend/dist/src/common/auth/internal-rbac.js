"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWarehouseOperator = isWarehouseOperator;
exports.isInternalAdmin = isInternalAdmin;
exports.canManageWarehouseUsers = canManageWarehouseUsers;
const client_1 = require("@prisma/client");
function isWarehouseOperator(role) {
    return role === client_1.UserRole.wh_operator;
}
function isInternalAdmin(role) {
    return role === client_1.UserRole.super_admin || role === client_1.UserRole.wh_manager;
}
function canManageWarehouseUsers(role) {
    return isInternalAdmin(role);
}
//# sourceMappingURL=internal-rbac.js.map