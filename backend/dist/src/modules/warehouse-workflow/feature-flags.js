"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inboundReceiveDefersPutaway = inboundReceiveDefersPutaway;
exports.outboundConfirmDefersDeduction = outboundConfirmDefersDeduction;
exports.taskOnlyFlows = taskOnlyFlows;
function inboundReceiveDefersPutaway(config) {
    return (config.get('TASK_WORKFLOW_INBOUND_RECEIVE_DEFERS_PUTAWAY') ?? '').toLowerCase() === 'true';
}
function outboundConfirmDefersDeduction(config) {
    return ((config.get('TASK_WORKFLOW_OUTBOUND_CONFIRM_DEFERS_DEDUCTION') ?? '').toLowerCase() === 'true');
}
function taskOnlyFlows(config) {
    const raw = (config.get('TASK_ONLY_FLOWS') ?? '').trim().toLowerCase();
    if (raw === 'false' || raw === '0' || raw === 'no' || raw === 'off')
        return false;
    return true;
}
//# sourceMappingURL=feature-flags.js.map