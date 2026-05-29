"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INVENTORY_POSTING_DISPOSITIONS = exports.PENDING_INSPECTION_DISPOSITIONS = void 0;
exports.isPendingInspectionDisposition = isPendingInspectionDisposition;
exports.isInventoryPostingDisposition = isInventoryPostingDisposition;
exports.normalizeReturnDisposition = normalizeReturnDisposition;
exports.stockStatusForDisposition = stockStatusForDisposition;
exports.assertLocationAllowedForDisposition = assertLocationAllowedForDisposition;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const storage_location_types_1 = require("../../common/constants/storage-location-types");
exports.PENDING_INSPECTION_DISPOSITIONS = [
    client_1.ReturnItemDisposition.inspection_required,
];
exports.INVENTORY_POSTING_DISPOSITIONS = [
    client_1.ReturnItemDisposition.restock,
    client_1.ReturnItemDisposition.quarantine,
    client_1.ReturnItemDisposition.damaged,
    client_1.ReturnItemDisposition.discard,
    client_1.ReturnItemDisposition.scrap,
];
function isPendingInspectionDisposition(disposition) {
    return !!disposition && exports.PENDING_INSPECTION_DISPOSITIONS.includes(disposition);
}
function isInventoryPostingDisposition(disposition) {
    if (!disposition)
        return false;
    if (disposition === client_1.ReturnItemDisposition.scrap)
        return true;
    return exports.INVENTORY_POSTING_DISPOSITIONS.includes(disposition);
}
function normalizeReturnDisposition(disposition) {
    return disposition === client_1.ReturnItemDisposition.scrap
        ? client_1.ReturnItemDisposition.discard
        : disposition;
}
function stockStatusForDisposition(disposition) {
    switch (normalizeReturnDisposition(disposition)) {
        case client_1.ReturnItemDisposition.restock:
            return client_1.StockStatus.available;
        case client_1.ReturnItemDisposition.quarantine:
        case client_1.ReturnItemDisposition.damaged:
            return client_1.StockStatus.quarantined;
        case client_1.ReturnItemDisposition.discard:
            return client_1.StockStatus.quarantined;
        default:
            return client_1.StockStatus.available;
    }
}
function assertLocationAllowedForDisposition(disposition, locationType) {
    const d = normalizeReturnDisposition(disposition);
    if (d === client_1.ReturnItemDisposition.restock) {
        if (!['internal', 'fridge'].includes(locationType)) {
            throw new common_1.BadRequestException('Restock returns must target sellable storage (internal or fridge).');
        }
        return;
    }
    if (d === client_1.ReturnItemDisposition.quarantine || d === client_1.ReturnItemDisposition.damaged) {
        if (!(0, storage_location_types_1.isQuarantineStorageLocationType)(locationType)) {
            throw new common_1.BadRequestException('Quarantine/damaged returns must target quarantine or scrap isolation bins.');
        }
        return;
    }
    if (d === client_1.ReturnItemDisposition.discard) {
        if (locationType !== 'scrap') {
            throw new common_1.BadRequestException('Discard returns must target a scrap location.');
        }
        return;
    }
    if (!(0, storage_location_types_1.isAdjustmentStockLocationType)(locationType)) {
        throw new common_1.BadRequestException('Invalid location type for return disposition.');
    }
}
//# sourceMappingURL=return-disposition.policy.js.map