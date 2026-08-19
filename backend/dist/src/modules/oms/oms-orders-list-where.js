"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildOmsOrdersListWhere = buildOmsOrdersListWhere;
const company_read_scope_1 = require("../../common/auth/company-read-scope");
const FULL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function buildOmsOrdersListWhere(companyAccess, user, query) {
    const where = {};
    const andParts = [];
    const companyId = (0, company_read_scope_1.readCompanyIdCatalogFilter)(companyAccess, user, query.companyId);
    if (companyId)
        where.companyId = companyId;
    if (query.status)
        where.status = query.status;
    if (query.storeChannel?.trim()) {
        where.storeChannel = { contains: query.storeChannel.trim(), mode: 'insensitive' };
    }
    if (query.linkStatus === 'linked')
        where.outboundOrderId = { not: null };
    if (query.linkStatus === 'unlinked')
        where.outboundOrderId = null;
    if (query.orderSearch?.trim()) {
        const t = query.orderSearch.trim();
        const orParts = [
            { orderNumber: { contains: t, mode: 'insensitive' } },
            { recipientName: { contains: t, mode: 'insensitive' } },
            { recipientPhone: { contains: t, mode: 'insensitive' } },
        ];
        if (FULL_UUID.test(t))
            orParts.push({ id: t });
        andParts.push({ OR: orParts });
    }
    if (query.createdFrom || query.createdTo) {
        const createdAt = {};
        if (query.createdFrom)
            createdAt.gte = new Date(`${query.createdFrom}T00:00:00.000Z`);
        if (query.createdTo)
            createdAt.lte = new Date(`${query.createdTo}T23:59:59.999Z`);
        where.createdAt = createdAt;
    }
    if (andParts.length > 0)
        where.AND = andParts;
    return where;
}
//# sourceMappingURL=oms-orders-list-where.js.map