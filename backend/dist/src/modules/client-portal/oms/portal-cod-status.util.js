"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.portalCodStatusFromRecord = portalCodStatusFromRecord;
const client_1 = require("@prisma/client");
function portalCodStatusFromRecord(status) {
    switch (status) {
        case client_1.CodRecordStatus.available:
            return 'collected';
        case client_1.CodRecordStatus.paid_out:
            return 'remitted';
        case client_1.CodRecordStatus.returned:
            return 'returned';
        case client_1.CodRecordStatus.pending:
        default:
            return 'pending';
    }
}
//# sourceMappingURL=portal-cod-status.util.js.map