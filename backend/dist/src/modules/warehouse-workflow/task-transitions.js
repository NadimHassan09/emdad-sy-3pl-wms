"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canTransitionTask = canTransitionTask;
const terminal = ['completed', 'cancelled'];
function canTransitionTask(from, to) {
    if (from === to)
        return false;
    if (terminal.includes(from) && to !== 'cancelled')
        return false;
    const edges = {
        pending: ['assigned', 'in_progress', 'cancelled'],
        assigned: ['pending', 'in_progress', 'cancelled'],
        in_progress: ['completed', 'blocked', 'cancelled', 'failed', 'retry_pending'],
        blocked: ['in_progress', 'cancelled'],
        retry_pending: ['in_progress', 'cancelled', 'failed'],
        failed: ['pending', 'assigned', 'in_progress', 'cancelled'],
        cancelled: [],
        completed: [],
    };
    return edges[from]?.includes(to) ?? false;
}
//# sourceMappingURL=task-transitions.js.map