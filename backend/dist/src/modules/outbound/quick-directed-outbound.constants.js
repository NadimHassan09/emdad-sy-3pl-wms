"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QUICK_DIRECTED_OUTBOUND_REF_PREFIX = void 0;
exports.isQuickDirectedOutboundClientReference = isQuickDirectedOutboundClientReference;
exports.quickDirectedReasonFromClientReference = quickDirectedReasonFromClientReference;
exports.QUICK_DIRECTED_OUTBOUND_REF_PREFIX = 'QDO-';
function isQuickDirectedOutboundClientReference(clientReference) {
    return (clientReference ?? '').startsWith(exports.QUICK_DIRECTED_OUTBOUND_REF_PREFIX);
}
function quickDirectedReasonFromClientReference(clientReference) {
    if (!isQuickDirectedOutboundClientReference(clientReference))
        return null;
    return (clientReference ?? '').slice(exports.QUICK_DIRECTED_OUTBOUND_REF_PREFIX.length) || null;
}
//# sourceMappingURL=quick-directed-outbound.constants.js.map