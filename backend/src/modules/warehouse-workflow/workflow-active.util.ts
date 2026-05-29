import { NotFoundException } from '@nestjs/common';
import { Prisma, WorkflowInstanceStatus, WorkflowReferenceType } from '@prisma/client';

/** Statuses counted as “active” for uniqueness and bootstrap idempotency. */
export const WORKFLOW_ACTIVE_STATUSES: WorkflowInstanceStatus[] = [
  WorkflowInstanceStatus.pending,
  WorkflowInstanceStatus.in_progress,
  WorkflowInstanceStatus.degraded,
];

export const WORKFLOW_ACTIVE_UNIQUE_INDEX = 'workflow_instances_one_active_per_reference_uidx';

export function isWorkflowActiveStatus(status: WorkflowInstanceStatus): boolean {
  return WORKFLOW_ACTIVE_STATUSES.includes(status);
}

export function activeWorkflowWhere(
  referenceType: WorkflowReferenceType,
  referenceId: string,
): Prisma.WorkflowInstanceWhereInput {
  return {
    referenceType,
    referenceId,
    status: { in: WORKFLOW_ACTIVE_STATUSES },
  };
}

/** Serialize workflow bootstrap for the same operational order. */
export async function lockWorkflowReferenceOrder(
  tx: Prisma.TransactionClient,
  referenceType: WorkflowReferenceType,
  referenceId: string,
): Promise<void> {
  if (referenceType === WorkflowReferenceType.outbound_order) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT id FROM outbound_orders WHERE id = ${referenceId}::uuid FOR UPDATE`,
    );
    if (rows.length === 0) throw new NotFoundException('Outbound order not found.');
    return;
  }
  if (referenceType === WorkflowReferenceType.inbound_order) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT id FROM inbound_orders WHERE id = ${referenceId}::uuid FOR UPDATE`,
    );
    if (rows.length === 0) throw new NotFoundException('Inbound order not found.');
    return;
  }
  throw new Error(`Unsupported workflow reference type: ${referenceType}`);
}

export async function findActiveWorkflowForReference(
  tx: Prisma.TransactionClient,
  referenceType: WorkflowReferenceType,
  referenceId: string,
) {
  return tx.workflowInstance.findFirst({
    where: activeWorkflowWhere(referenceType, referenceId),
    orderBy: { createdAt: 'desc' },
  });
}

export async function loadWorkflowBootstrapBundle(
  tx: Prisma.TransactionClient,
  workflowInstanceId: string,
) {
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

export function isActiveWorkflowUniqueViolation(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (err.code !== 'P2002') return false;
  const target = err.meta?.target;
  const label = Array.isArray(target) ? target.join(',') : String(target ?? '');
  return (
    label.includes(WORKFLOW_ACTIVE_UNIQUE_INDEX) ||
    (label.includes('reference_type') && label.includes('reference_id'))
  );
}
