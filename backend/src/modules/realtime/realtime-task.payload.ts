import type { PrismaService } from '../../common/prisma/prisma.service';
import {
  getFrontierBlockedReason,
  type TaskRunnableShape,
} from '../warehouse-workflow/task-runnable.util';

type TaskRow = {
  id: string;
  taskType: string;
  status: string;
  workflowInstance: {
    id: string;
    companyId: string;
    referenceType: string;
    referenceId: string;
    warehouseId: string;
  };
  assignments: Array<{
    worker?: {
      id: string;
      displayName: string;
      user?: { fullName?: string | null; email?: string | null } | null;
    };
  }>;
};

export async function buildTaskListPayload(
  prisma: PrismaService,
  taskId: string,
): Promise<Record<string, unknown> | null> {
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
  if (!task) return null;

  const siblings = await prisma.warehouseTask.findMany({
    where: { workflowInstanceId: task.workflowInstanceId },
    select: { id: true, taskType: true, status: true },
  });

  const refType = task.workflowInstance.referenceType;
  const blocked = getFrontierBlockedReason(
    task.id,
    siblings as TaskRunnableShape[],
    refType,
  );
  const actionable = ['pending', 'assigned', 'in_progress'].includes(task.status);

  const listItem: TaskRow & {
    is_current_runnable?: boolean;
    runnability_blocked_reason?: string | null;
  } = {
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
