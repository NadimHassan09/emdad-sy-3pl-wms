import {
  WorkerOperationalRole,
  WorkerOperationalStatus,
  type Prisma,
} from '@prisma/client';

export const DEFAULT_WORKER_ROLES: WorkerOperationalRole[] = ['receiver', 'picker', 'packer'];

export type UserWorkerProfileSummary = {
  id: string;
  status: WorkerOperationalStatus;
  warehouseId: string | null;
  warehouseCode: string | null;
  warehouseName: string | null;
  roles: WorkerOperationalRole[];
};

const WORKER_PROFILE_SELECT = {
  id: true,
  status: true,
  warehouseId: true,
  roles: { select: { role: true } },
  warehouse: { select: { code: true, name: true } },
} satisfies Prisma.WorkerSelect;

export { WORKER_PROFILE_SELECT };

export function toWorkerProfileSummary(
  worker: Prisma.WorkerGetPayload<{ select: typeof WORKER_PROFILE_SELECT }> | null | undefined,
): UserWorkerProfileSummary | null {
  if (!worker) return null;
  return {
    id: worker.id,
    status: worker.status,
    warehouseId: worker.warehouseId,
    warehouseCode: worker.warehouse?.code ?? null,
    warehouseName: worker.warehouse?.name ?? null,
    roles: worker.roles.map((r) => r.role),
  };
}
