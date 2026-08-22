"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDamagedQtyFromNotes = parseDamagedQtyFromNotes;
exports.resolveDamagedQty = resolveDamagedQty;
exports.assertReceivingQuantitiesWithinExpected = assertReceivingQuantitiesWithinExpected;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
function parseDamagedQtyFromNotes(notes) {
    if (!notes?.trim())
        return new client_1.Prisma.Decimal(0);
    const m = /(?:^|\s|·)damaged:([\d.]+)/i.exec(notes);
    if (!m?.[1])
        return new client_1.Prisma.Decimal(0);
    try {
        const d = new client_1.Prisma.Decimal(m[1]);
        return d.isNeg() ? new client_1.Prisma.Decimal(0) : d;
    }
    catch {
        return new client_1.Prisma.Decimal(0);
    }
}
function resolveDamagedQty(damagedQty, discrepancyNotes) {
    if (damagedQty !== undefined && damagedQty !== null && String(damagedQty).trim() !== '') {
        try {
            return new client_1.Prisma.Decimal(damagedQty);
        }
        catch {
            throw new common_1.BadRequestException('Damaged quantity must be a valid number.');
        }
    }
    return parseDamagedQtyFromNotes(discrepancyNotes);
}
function assertReceivingQuantitiesWithinExpected(input) {
    const { expected, receivedQty, damagedQty } = input;
    const prior = input.priorReceived ?? new client_1.Prisma.Decimal(0);
    const lineHint = input.lineId ? ` for line ${input.lineId}` : '';
    if (receivedQty.isNeg()) {
        throw new common_1.BadRequestException(`Received quantity cannot be negative${lineHint}.`);
    }
    if (damagedQty.isNeg()) {
        throw new common_1.BadRequestException(`Damaged quantity cannot be negative${lineHint}.`);
    }
    const payloadAccounted = receivedQty.add(damagedQty);
    if (payloadAccounted.greaterThan(expected)) {
        throw new common_1.BadRequestException(`Received + damaged (${payloadAccounted.toString()}) exceeds expected (${expected.toString()})${lineHint}.`);
    }
    const totalAccounted = prior.add(receivedQty).add(damagedQty);
    if (totalAccounted.greaterThan(expected)) {
        throw new common_1.BadRequestException(`Total received + damaged (${totalAccounted.toString()}) would exceed expected (${expected.toString()})${lineHint}.`);
    }
}
//# sourceMappingURL=receiving-qty.validation.js.map