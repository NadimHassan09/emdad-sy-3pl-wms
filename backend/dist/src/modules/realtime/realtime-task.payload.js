"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTaskListPayload = buildTaskListPayload;
const task_runnable_util_1 = require("../warehouse-workflow/task-runnable.util");
async function buildTaskListPayload(prisma, taskId) {
    const task = await prisma.warehouseTask.findUnique({
        where: { id: taskId },
        include: {
            workflowInstance: {
                select: {
                    id: true,
                    companyId: true,
                    referenceType: true,
                    referenceId: true,
                    warehouseId: true,
                },
            },
            assignments: {
                where: { unassignedAt: null },
                orderBy: { assignedAt: 'desc' },
                take: 1,
                include: {
                    worker: {
                        include: {
                            user: { select: { fullName: true, email: true } },
                        },
                    },
                },
            },
        },
    });
    if (!task)
        return null;
    const siblings = await prisma.warehouseTask.findMany({
        where: { workflowInstanceId: task.workflowInstanceId },
        select: { id: true, taskType: true, status: true },
    });
    const refType = task.workflowInstance.referenceType;
    const blocked = (0, task_runnable_util_1.getFrontierBlockedReason)(task.id, siblings, refType);
    const actionable = ['pending', 'assigned', 'in_progress'].includes(task.status);
    const listItem = {
        id: task.id,
        taskType: task.taskType,
        status: task.status,
        workflowInstance: task.workflowInstance,
        assignments: task.assignments.map((a) => ({
            worker: a.worker
                ? {
                    id: a.worker.id,
                    displayName: a.worker.displayName,
                    user: a.worker.user,
                }
                : undefined,
        })),
        is_current_runnable: blocked === null && actionable,
        runnability_blocked_reason: blocked,
    };
    return {
        taskId: task.id,
        warehouseId: task.workflowInstance.warehouseId,
        companyId: task.workflowInstance.companyId,
        task: listItem,
        workflowInstanceId: task.workflowInstance.id,
        referenceType: refType,
        referenceId: task.workflowInstance.referenceId,
    };
}
//# sourceMappingURL=realtime-task.payload.js.map