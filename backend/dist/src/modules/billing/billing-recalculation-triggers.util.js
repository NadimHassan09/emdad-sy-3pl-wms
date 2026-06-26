"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.billingTriggerForWarehouseTask = billingTriggerForWarehouseTask;
function billingTriggerForWarehouseTask(args) {
    if (args.inboundCompleted)
        return 'inbound_completed';
    if (args.outboundCompleted)
        return 'outbound_completed';
    if (args.taskType === 'pack')
        return 'packaging_completed';
    if (args.taskType === 'qc')
        return 'quality_check_completed';
    if (args.taskType === 'receiving' ||
        args.taskType === 'putaway' ||
        args.taskType === 'putaway_quarantine' ||
        args.taskType === 'dispatch') {
        return 'usage_changed';
    }
    return null;
}
//# sourceMappingURL=billing-recalculation-triggers.util.js.map