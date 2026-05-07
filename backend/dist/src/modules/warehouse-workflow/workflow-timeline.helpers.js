"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildWorkflowTimelineSteps = buildWorkflowTimelineSteps;
const client_1 = require("@prisma/client");
const task_runnable_util_1 = require("./task-runnable.util");
const TERMINAL = [
    client_1.WarehouseTaskStatus.completed,
    client_1.WarehouseTaskStatus.cancelled,
];
function matchesTypes(t, allowed) {
    return allowed.includes(t);
}
function matchesForStep(tasks, types) {
    return tasks.filter((t) => matchesTypes(t.taskType, types)).sort((a, b) => +a.createdAt - +b.createdAt);
}
function deriveStepStatus(matches, light, referenceTag) {
    if (matches.length === 0)
        return 'locked';
    const allDone = matches.length > 0 &&
        matches.every((t) => t.status === client_1.WarehouseTaskStatus.completed);
    if (allDone)
        return 'done';
    const open = matches.filter((t) => !TERMINAL.includes(t.status));
    if (open.length === 0)
        return 'done';
    const runnable = open.some((t) => (0, task_runnable_util_1.getFrontierBlockedReason)(t.id, light, referenceTag) === null);
    return runnable ? 'pending' : 'locked';
}
const INBOUND_TEMPLATE = [
    { key: 'receive', label: 'Receive', taskTypes: [client_1.WarehouseTaskType.receiving] },
    {
        key: 'putaway',
        label: 'Putaway',
        taskTypes: [client_1.WarehouseTaskType.putaway, client_1.WarehouseTaskType.putaway_quarantine],
    },
];
const OUTBOUND_TEMPLATE = [
    { key: 'pick', label: 'Pick', taskTypes: [client_1.WarehouseTaskType.pick] },
    { key: 'pack', label: 'Pack', taskTypes: [client_1.WarehouseTaskType.pack] },
    { key: 'dispatch', label: 'Dispatch', taskTypes: [client_1.WarehouseTaskType.dispatch] },
];
function buildWorkflowTimelineSteps(referenceType, tasks) {
    const light = tasks.map((t) => ({
        id: t.id,
        workflowInstanceId: t.workflowInstanceId,
        taskType: t.taskType,
        status: t.status,
    }));
    const tmpl = referenceType === 'inbound_order' ? INBOUND_TEMPLATE : OUTBOUND_TEMPLATE;
    return tmpl.map((def) => {
        const matches = matchesForStep(tasks, def.taskTypes);
        return {
            key: def.key,
            label: def.label,
            status: deriveStepStatus(matches, light, referenceType),
            taskId: matches[0]?.id ?? null,
        };
    });
}
//# sourceMappingURL=workflow-timeline.helpers.js.map