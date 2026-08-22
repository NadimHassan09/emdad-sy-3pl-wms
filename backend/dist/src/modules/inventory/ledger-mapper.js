"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INTERNAL_LEDGER_MOVEMENTS = exports.PRIMARY_LEDGER_MOVEMENTS = void 0;
exports.ledgerSignedQuantity = ledgerSignedQuantity;
exports.toLedgerDisplayMovement = toLedgerDisplayMovement;
const client_1 = require("@prisma/client");
function ledgerSignedQuantity(movementType, quantity) {
    const neg = [
        client_1.MovementType.outbound_pick,
        client_1.MovementType.adjustment_negative,
        client_1.MovementType.scrap,
        client_1.MovementType.transit_out,
        client_1.MovementType.qc_quarantine,
    ];
    const mult = neg.includes(movementType) ? -1 : 1;
    return quantity.mul(mult).toString();
}
exports.PRIMARY_LEDGER_MOVEMENTS = [
    client_1.MovementType.inbound_receive,
    client_1.MovementType.outbound_pick,
    client_1.MovementType.return_receive,
];
exports.INTERNAL_LEDGER_MOVEMENTS = [
    client_1.MovementType.adjustment_positive,
    client_1.MovementType.adjustment_negative,
    client_1.MovementType.internal_transfer,
    client_1.MovementType.scrap,
    client_1.MovementType.qc_quarantine,
    client_1.MovementType.qc_release,
    client_1.MovementType.putaway,
    client_1.MovementType.transit_in,
    client_1.MovementType.transit_out,
];
function toLedgerDisplayMovement(movementType) {
    switch (movementType) {
        case client_1.MovementType.inbound_receive:
        case client_1.MovementType.transit_in:
            return 'inbound';
        case client_1.MovementType.outbound_pick:
        case client_1.MovementType.transit_out:
            return 'outbound';
        case client_1.MovementType.return_receive:
            return 'return';
        case client_1.MovementType.internal_transfer:
            return 'transfer';
        case client_1.MovementType.scrap:
            return 'scrap';
        case client_1.MovementType.qc_quarantine:
        case client_1.MovementType.qc_release:
            return 'qc';
        case client_1.MovementType.adjustment_positive:
        case client_1.MovementType.adjustment_negative:
        case client_1.MovementType.putaway:
        default:
            return 'adjustment';
    }
}
//# sourceMappingURL=ledger-mapper.js.map