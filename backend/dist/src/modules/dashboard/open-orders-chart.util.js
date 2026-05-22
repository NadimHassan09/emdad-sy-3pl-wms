"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activeFrontierGroupIndex = activeFrontierGroupIndex;
exports.isOpenOrderTaskInProgress = isOpenOrderTaskInProgress;
exports.buildInboundOpenOrdersChart = buildInboundOpenOrdersChart;
exports.buildOutboundOpenOrdersChart = buildOutboundOpenOrdersChart;
const client_1 = require("@prisma/client");
const task_runnable_util_1 = require("../warehouse-workflow/task-runnable.util");
const TERMINAL = [
    client_1.WarehouseTaskStatus.completed,
    client_1.WarehouseTaskStatus.cancelled,
];
function isTerminal(status) {
    return TERMINAL.includes(status);
}
function taskGroups(referenceType) {
    return referenceType === 'inbound_order'
        ? [[client_1.WarehouseTaskType.receiving], [client_1.WarehouseTaskType.putaway, client_1.WarehouseTaskType.putaway_quarantine]]
        : [[client_1.WarehouseTaskType.pick], [client_1.WarehouseTaskType.pack], [client_1.WarehouseTaskType.dispatch]];
}
function activeFrontierGroupIndex(tasks, referenceType) {
    const groups = taskGroups(referenceType);
    for (let i = 0; i < groups.length; i++) {
        const subset = tasks.filter((t) => groups[i].includes(t.taskType));
        if (subset.length === 0)
            continue;
        if (!subset.every((t) => isTerminal(t.status)))
            return i;
    }
    return -1;
}
function isOpenOrderTaskInProgress(tasks, referenceType) {
    if (tasks.length === 0)
        return false;
    const runnableIds = (0, task_runnable_util_1.computeRunnableTaskIds)(tasks, referenceType);
    const runnable = tasks.filter((t) => runnableIds.has(t.id));
    if (runnable.length > 0) {
        return runnable.some((t) => t.status !== client_1.WarehouseTaskStatus.pending);
    }
    return tasks.some((t) => !isTerminal(t.status) &&
        t.status !== client_1.WarehouseTaskStatus.pending &&
        t.status !== client_1.WarehouseTaskStatus.failed);
}
function inboundBucket(hasWorkflow, groupIndex) {
    if (!hasWorkflow || groupIndex < 0)
        return 'new';
    if (groupIndex === 0)
        return 'receive';
    return 'putaway';
}
function outboundBucket(hasWorkflow, groupIndex) {
    if (!hasWorkflow || groupIndex < 0)
        return 'picking';
    if (groupIndex === 0)
        return 'picking';
    if (groupIndex === 1)
        return 'packing';
    return 'shipping';
}
function buildInboundOpenOrdersChart(orders, workflowByOrderId, tasksByInstanceId) {
    const counts = { new: 0, receive: 0, putaway: 0 };
    let inProgress = 0;
    let notInProgress = 0;
    for (const order of orders) {
        const instanceId = workflowByOrderId.get(order.id);
        const hasWorkflow = Boolean(instanceId);
        const tasks = instanceId ? (tasksByInstanceId.get(instanceId) ?? []) : [];
        const groupIndex = hasWorkflow ? activeFrontierGroupIndex(tasks, 'inbound_order') : -1;
        const bucket = inboundBucket(hasWorkflow, groupIndex);
        counts[bucket] += 1;
        if (isOpenOrderTaskInProgress(tasks, 'inbound_order')) {
            inProgress += 1;
        }
        else {
            notInProgress += 1;
        }
    }
    return {
        stages: [
            { key: 'new', label: 'New', count: counts.new },
            { key: 'receive', label: 'Receive', count: counts.receive },
            { key: 'putaway', label: 'Putaway', count: counts.putaway },
        ],
        inProgress,
        notInProgress,
    };
}
function buildOutboundOpenOrdersChart(orders, workflowByOrderId, tasksByInstanceId) {
    const counts = { picking: 0, packing: 0, shipping: 0 };
    let inProgress = 0;
    let notInProgress = 0;
    for (const order of orders) {
        const instanceId = workflowByOrderId.get(order.id);
        const hasWorkflow = Boolean(instanceId);
        const tasks = instanceId ? (tasksByInstanceId.get(instanceId) ?? []) : [];
        const groupIndex = hasWorkflow ? activeFrontierGroupIndex(tasks, 'outbound_order') : -1;
        const bucket = outboundBucket(hasWorkflow, groupIndex);
        counts[bucket] += 1;
        if (isOpenOrderTaskInProgress(tasks, 'outbound_order')) {
            inProgress += 1;
        }
        else {
            notInProgress += 1;
        }
    }
    return {
        stages: [
            { key: 'picking', label: 'Picking', count: counts.picking },
            { key: 'packing', label: 'Packing', count: counts.packing },
            { key: 'shipping', label: 'Shipping', count: counts.shipping },
        ],
        inProgress,
        notInProgress,
    };
}
//# sourceMappingURL=open-orders-chart.util.js.map