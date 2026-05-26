"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clientAuthPrincipal = clientAuthPrincipal;
function clientAuthPrincipal(client) {
    return {
        id: client.id,
        companyId: client.companyId,
        role: client.role,
        email: client.email ?? undefined,
        tenantScope: 'restricted',
        authorizedCompanyIds: [client.companyId],
    };
}
//# sourceMappingURL=client-auth-principal.js.map