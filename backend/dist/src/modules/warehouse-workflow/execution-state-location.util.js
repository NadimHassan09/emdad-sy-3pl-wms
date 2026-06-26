"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readPickDraftPackingDestinationId = readPickDraftPackingDestinationId;
exports.readPackDraftPackingStationId = readPackDraftPackingStationId;
function isRecord(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
}
function readPickDraftPackingDestinationId(raw) {
    if (!isRecord(raw))
        return null;
    const d = raw.pick_draft ?? raw.pickDraft;
    if (!isRecord(d))
        return null;
    const id = d.packingDestinationId ?? d.packing_destination_id;
    return typeof id === 'string' && id.trim() ? id.trim() : null;
}
function readPackDraftPackingStationId(raw) {
    if (!isRecord(raw))
        return null;
    const d = raw.pack_draft ?? raw.packDraft;
    if (!isRecord(d))
        return null;
    const id = d.packingStationId ?? d.packing_station_id;
    return typeof id === 'string' && id.trim() ? id.trim() : null;
}
//# sourceMappingURL=execution-state-location.util.js.map