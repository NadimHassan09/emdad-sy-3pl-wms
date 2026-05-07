"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RUNN_BLOCKED_ASSIGNMENT_REQUIRED = exports.RUNN_BLOCKED_SKILL_GAP = exports.RUNN_BLOCKED_NOT_ON_FRONT = void 0;
exports.computeRunnableTaskIds = computeRunnableTaskIds;
exports.getFrontierBlockedReason = getFrontierBlockedReason;
const client_1 = require("@prisma/client");
exports.RUNN_BLOCKED_NOT_ON_FRONT = 'NOT_ON_WORKFLOW_FRONT';
exports.RUNN_BLOCKED_SKILL_GAP = 'WORKER_MISSING_REQUIRED_SKILLS';
exports.RUNN_BLOCKED_ASSIGNMENT_REQUIRED = 'ASSIGNMENT_REQUIRED_FOR_SKILLS';
const terminal = [
    client_1.WarehouseTaskStatus.completed,
    client_1.WarehouseTaskStatus.cancelled,
];
function isTerminal(s) {
    return terminal.includes(s);
}
function isActionable(s) {
    return (s === client_1.WarehouseTaskStatus.pending ||
        s === client_1.WarehouseTaskStatus.assigned ||
        s === client_1.WarehouseTaskStatus.in_progress);
}
function computeRunnableTaskIds(tasks, referenceType) {
    const groups = referenceType === 'inbound_order'
        ? [
            [client_1.WarehouseTaskType.receiving],
            [client_1.WarehouseTaskType.putaway, client_1.WarehouseTaskType.putaway_quarantine],
        ]
        : [
            [client_1.WarehouseTaskType.pick],
            [client_1.WarehouseTaskType.pack],
            [client_1.WarehouseTaskType.dispatch],
        ];
    const run = new Set();
    for (const g of groups) {
        const subset = tasks.filter((t) => g.includes(t.taskType));
        if (subset.length === 0) {
            continue;
        }
        const done = subset.every((t) => isTerminal(t.status));
        if (!done) {
            for (const t of subset) {
                if (isActionable(t.status)) {
                    run.add(t.id);
                }
            }
            break;
        }
    }
    return run;
}
function getFrontierBlockedReason(taskId, tasks, referenceType) {
    if (computeRunnableTaskIds(tasks, referenceType).has(taskId))
        return null;
    return exports.RUNN_BLOCKED_NOT_ON_FRONT;
}
//# sourceMappingURL=task-runnable.util.js.map