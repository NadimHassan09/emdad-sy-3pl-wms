"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertUniqueReturnLineBuckets = assertUniqueReturnLineBuckets;
exports.buildReturnListSummary = buildReturnListSummary;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const returns_constants_1 = require("./returns.constants");
function assertUniqueReturnLineBuckets(lines) {
    if (lines.length > returns_constants_1.MAX_RETURN_LINES_PER_ORDER) {
        throw new common_1.BadRequestException(`A return order cannot exceed ${returns_constants_1.MAX_RETURN_LINES_PER_ORDER} lines.`);
    }
    const seenOutboundLine = new Set();
    const seenProductLot = new Set();
    for (const line of lines) {
        if (line.outboundOrderLineId) {
            if (seenOutboundLine.has(line.outboundOrderLineId)) {
                throw new common_1.BadRequestException('Duplicate outbound order line in return payload. Merge quantities into one line.');
            }
            seenOutboundLine.add(line.outboundOrderLineId);
            continue;
        }
        const key = `${line.productId}:${line.lotId ?? ''}`;
        if (seenProductLot.has(key)) {
            throw new common_1.BadRequestException('Duplicate product/lot in return payload. Merge quantities into one line.');
        }
        seenProductLot.add(key);
    }
}
function buildReturnListSummary(lines) {
    const skus = [...new Set(lines.map((l) => l.product.sku))];
    const productSummary = skus.length === 0
        ? '—'
        : skus.length <= 3
            ? skus.join(', ')
            : `${skus.slice(0, 2).join(', ')} +${skus.length - 2}`;
    const totalExpected = lines.reduce((sum, l) => sum.add(l.expectedQuantity), new client_1.Prisma.Decimal(0));
    const totalReceived = lines.reduce((sum, l) => sum.add(l.receivedQuantity), new client_1.Prisma.Decimal(0));
    const dispositions = [
        ...new Set(lines.map((l) => l.disposition).filter((d) => !!d)),
    ];
    let dispositionSummary = null;
    if (dispositions.length === 1) {
        dispositionSummary = dispositions[0];
    }
    else if (dispositions.length > 1) {
        dispositionSummary = 'mixed';
    }
    return {
        lineCount: lines.length,
        productSummary,
        totalExpected: totalExpected.toString(),
        totalReceived: totalReceived.toString(),
        dispositionSummary,
    };
}
//# sourceMappingURL=return-line-integrity.util.js.map