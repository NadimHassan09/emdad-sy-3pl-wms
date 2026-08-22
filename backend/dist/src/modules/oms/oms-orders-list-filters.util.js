"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseOmsTotalFilterValue = parseOmsTotalFilterValue;
exports.appendOmsOrderFieldFilters = appendOmsOrderFieldFilters;
const client_1 = require("@prisma/client");
const FULL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function parseOmsTotalFilterValue(raw) {
    if (raw == null)
        return null;
    const t = raw.trim();
    if (!t)
        return null;
    if (!/^\d+(\.\d{1,4})?$/.test(t))
        return null;
    try {
        const d = new client_1.Prisma.Decimal(t);
        if (!d.isFinite() || d.isNegative())
            return null;
        return d;
    }
    catch {
        return null;
    }
}
function appendOmsOrderFieldFilters(query, where, andParts) {
    if (query.orderSearch?.trim()) {
        const t = query.orderSearch.trim();
        const orParts = [
            { orderNumber: { contains: t, mode: 'insensitive' } },
            { recipientName: { contains: t, mode: 'insensitive' } },
            { recipientPhone: { contains: t, mode: 'insensitive' } },
            { externalReference: { contains: t, mode: 'insensitive' } },
            { clientReference: { contains: t, mode: 'insensitive' } },
        ];
        if (FULL_UUID.test(t))
            orParts.push({ id: t });
        andParts.push({ OR: orParts });
    }
    if (query.orderId?.trim()) {
        const t = query.orderId.trim();
        const orParts = [
            { orderNumber: { contains: t, mode: 'insensitive' } },
            { externalReference: { contains: t, mode: 'insensitive' } },
            { clientReference: { contains: t, mode: 'insensitive' } },
        ];
        if (FULL_UUID.test(t))
            orParts.push({ id: t });
        andParts.push({ OR: orParts });
    }
    if (query.customer?.trim()) {
        andParts.push({
            recipientName: { contains: query.customer.trim(), mode: 'insensitive' },
        });
    }
    if (query.phone?.trim()) {
        andParts.push({
            recipientPhone: { contains: query.phone.trim(), mode: 'insensitive' },
        });
    }
    if (query.city?.trim()) {
        andParts.push({
            city: { contains: query.city.trim(), mode: 'insensitive' },
        });
    }
    const totalValue = parseOmsTotalFilterValue(query.totalValue);
    const op = query.totalOp;
    if (totalValue != null && op) {
        const filter = op === 'eq'
            ? { equals: totalValue }
            : op === 'gt'
                ? { gt: totalValue }
                : op === 'gte'
                    ? { gte: totalValue }
                    : op === 'lt'
                        ? { lt: totalValue }
                        : { lte: totalValue };
        where.subtotal = filter;
    }
}
//# sourceMappingURL=oms-orders-list-filters.util.js.map