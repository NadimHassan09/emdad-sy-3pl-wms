"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildQuickDirectedPickMessages = buildQuickDirectedPickMessages;
function formatQty(qty) {
    const n = Number(qty);
    if (Number.isNaN(n))
        return qty;
    return Number.isInteger(n) ? String(n) : n.toLocaleString('en-US', { maximumFractionDigits: 4 });
}
function buildQuickDirectedPickMessages(slices) {
    if (slices.length === 0) {
        return {
            messageEn: 'Outbound completed successfully.',
            messageAr: 'تم الإخراج بنجاح.',
        };
    }
    if (slices.length === 1) {
        const slice = slices[0];
        const qty = formatQty(slice.quantity);
        return {
            messageEn: `Outbound successful! Please pull ${qty} from shelf: ${slice.locationLabel}.`,
            messageAr: `تم الإخراج بنجاح! يرجى سحب ${qty} من الرف: ${slice.locationLabel}.`,
        };
    }
    const partsEn = slices
        .map((slice) => `${formatQty(slice.quantity)} from ${slice.locationLabel}`)
        .join(' and ');
    const partsAr = slices
        .map((slice) => `${formatQty(slice.quantity)} من ${slice.locationLabel}`)
        .join(' و ');
    return {
        messageEn: `Outbound successful! Please pull: ${partsEn}.`,
        messageAr: `تم الإخراج! يرجى سحب: ${partsAr}.`,
    };
}
//# sourceMappingURL=quick-directed-outbound.helper.js.map