"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORKFLOW_ACTIVE_UNIQUE_INDEX = exports.WORKFLOW_ACTIVE_STATUSES = void 0;
exports.isWorkflowActiveStatus = isWorkflowActiveStatus;
exports.activeWorkflowWhere = activeWorkflowWhere;
exports.lockWorkflowReferenceOrder = lockWorkflowReferenceOrder;
exports.findActiveWorkflowForReference = findActiveWorkflowForReference;
exports.loadWorkflowBootstrapBundle = loadWorkflowBootstrapBundle;
exports.isActiveWorkflowUniqueViolation = isActiveWorkflowUniqueViolation;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
exports.WORKFLOW_ACTIVE_STATUSES = [
    client_1.WorkflowInstanceStatus.pending,
    client_1.WorkflowInstanceStatus.in_progress,
    client_1.WorkflowInstanceStatus.degraded,
];
exports.WORKFLOW_ACTIVE_UNIQUE_INDEX = 'workflow_instances_one_active_per_reference_uidx';
function isWorkflowActiveStatus(status) {
    return exports.WORKFLOW_ACTIVE_STATUSES.includes(status);
}
function activeWorkflowWhere(referenceType, referenceId) {
    return {
        referenceType,
        referenceId,
        status: { in: exports.WORKFLOW_ACTIVE_STATUSES },
    };
}
async function lockWorkflowReferenceOrder(tx, referenceType, referenceId) {
    if (referenceType === client_1.WorkflowReferenceType.outbound_order) {
        const rows = await tx.$queryRaw(client_1.Prisma.sql `SELECT id FROM outbound_orders WHERE id = ${referenceId}::uuid FOR UPDATE`);
        if (rows.length === 0)
            throw new common_1.NotFoundException('Outbound order not found.');
        return;
    }
    if (referenceType === client_1.WorkflowReferenceType.inbound_order) {
        const rows = await tx.$queryRaw(client_1.Prisma.sql `SELECT id FROM inbound_orders WHERE id = ${referenceId}::uuid FOR UPDATE`);
        if (rows.length === 0)
            throw new common_1.NotFoundException('Inbound order not found.');
        return;
    }
    throw new Error(`Unsupported workflow reference type: ${referenceType}`);
}
async function findActiveWorkflowForReference(tx, referenceType, referenceId) {
    return tx.workflowInstance.findFirst({
        where: activeWorkflowWhere(referenceType, referenceId),
        orderBy: { createdAt: 'desc' },
    });
}
async function loadWorkflowBootstrapBundle(tx, workflowInstanceId) {
    const workflowInstance = await tx.workflowInstance.findUniqueOrThrow({
        where: { id: workflowInstanceId },
    });
    const [tasks, nodes] = await Promise.all([
        tx.warehouseTask.findMany({
            where: { workflowInstanceId },
            orderBy: { id: 'asc' },
        }),
        tx.workflowNode.findMany({
            where: { instanceId: workflowInstanceId },
            orderBy: { sequence: 'asc' },
        }),
    ]);
    return { workflowInstance, nodes, tasks };
}
function isActiveWorkflowUniqueViolation(err) {
    if (!(err instanceof client_1.Prisma.PrismaClientKnownRequestError))
        return false;
    if (err.code !== 'P2002')
        return false;
    const target = err.meta?.target;
    const label = Array.isArray(target) ? target.join(',') : String(target ?? '');
    return (label.includes(exports.WORKFLOW_ACTIVE_UNIQUE_INDEX) ||
        (label.includes('reference_type') && label.includes('reference_id')));
}
//# sourceMappingURL=workflow-active.util.js.map