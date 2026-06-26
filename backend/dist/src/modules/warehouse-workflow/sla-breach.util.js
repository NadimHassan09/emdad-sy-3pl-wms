"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SLA_ESCALATION_COOLDOWN_MS = void 0;
exports.slaTaskTypeLabel = slaTaskTypeLabel;
exports.slaBreachDeadlineMs = slaBreachDeadlineMs;
exports.isTaskSlaBreached = isTaskSlaBreached;
exports.slaOverdueMinutes = slaOverdueMinutes;
const client_1 = require("@prisma/client");
exports.SLA_ESCALATION_COOLDOWN_MS = 60 * 60 * 1000;
const TASK_TYPE_LABELS = {
    [client_1.WarehouseTaskType.receiving]: 'Receive',
    [client_1.WarehouseTaskType.qc]: 'QC',
    [client_1.WarehouseTaskType.putaway]: 'Putaway',
    [client_1.WarehouseTaskType.putaway_quarantine]: 'Putaway (quarantine)',
    [client_1.WarehouseTaskType.pick]: 'Pick',
    [client_1.WarehouseTaskType.pack]: 'Pack',
    [client_1.WarehouseTaskType.dispatch]: 'Dispatch',
};
function slaTaskTypeLabel(taskType) {
    return TASK_TYPE_LABELS[taskType] ?? taskType;
}
function slaBreachDeadlineMs(startedAt, slaMinutes) {
    return startedAt.getTime() + slaMinutes * 60_000;
}
function isTaskSlaBreached(task, nowMs = Date.now()) {
    if (task.startedAt == null || task.slaMinutes == null)
        return false;
    return nowMs > slaBreachDeadlineMs(task.startedAt, task.slaMinutes);
}
function slaOverdueMinutes(startedAt, slaMinutes, nowMs = Date.now()) {
    const deadline = slaBreachDeadlineMs(startedAt, slaMinutes);
    return Math.max(0, Math.floor((nowMs - deadline) / 60_000));
}
//# sourceMappingURL=sla-breach.util.js.map