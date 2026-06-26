"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setTenantRlsContext = setTenantRlsContext;
exports.withTenantRls = withTenantRls;
const client_1 = require("@prisma/client");
const INTERNAL_ROLES = new Set([
    'super_admin',
    'wh_manager',
    'wh_operator',
    'finance',
]);
async function setTenantRlsContext(tx, user) {
    const isInternal = INTERNAL_ROLES.has(user.role);
    const companyCtx = isInternal ? '' : user.companyId ?? '';
    await tx.$executeRaw(client_1.Prisma.sql `SELECT set_config('app.user_role', ${user.role}, true)`);
    await tx.$executeRaw(client_1.Prisma.sql `SELECT set_config('app.current_company_id', ${companyCtx}, true)`);
}
async function withTenantRls(prisma, user, fn) {
    return prisma.$transaction(async (tx) => {
        await setTenantRlsContext(tx, user);
        return fn(tx);
    });
}
//# sourceMappingURL=tenant-rls.js.map