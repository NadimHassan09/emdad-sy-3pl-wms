"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthGroup = void 0;
exports.userRoleToAuthGroup = userRoleToAuthGroup;
const client_1 = require("@prisma/client");
var AuthGroup;
(function (AuthGroup) {
    AuthGroup["ADMIN"] = "ADMIN";
    AuthGroup["OPERATOR"] = "OPERATOR";
})(AuthGroup || (exports.AuthGroup = AuthGroup = {}));
function userRoleToAuthGroup(role) {
    if (role === client_1.UserRole.wh_operator)
        return AuthGroup.OPERATOR;
    return AuthGroup.ADMIN;
}
//# sourceMappingURL=auth-groups.js.map