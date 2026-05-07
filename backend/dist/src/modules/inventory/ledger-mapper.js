"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ledgerSignedQuantity = ledgerSignedQuantity;
function ledgerSignedQuantity(movementType, quantity) {
    const neg = [
        'outbound_pick',
        'adjustment_negative',
        'scrap',
        'transit_out',
        'qc_quarantine',
    ];
    const mult = neg.includes(movementType) ? -1 : 1;
    return quantity.mul(mult).toString();
}
//# sourceMappingURL=ledger-mapper.js.map