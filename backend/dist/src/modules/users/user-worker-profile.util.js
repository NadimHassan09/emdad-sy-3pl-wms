"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORKER_PROFILE_SELECT = exports.DEFAULT_WORKER_ROLES = void 0;
exports.toWorkerProfileSummary = toWorkerProfileSummary;
exports.DEFAULT_WORKER_ROLES = ['receiver', 'picker', 'packer'];
const WORKER_PROFILE_SELECT = {
    id: true,
    status: true,
    warehouseId: true,
    roles: { select: { role: true } },
    warehouse: { select: { code: true, name: true } },
};
exports.WORKER_PROFILE_SELECT = WORKER_PROFILE_SELECT;
function toWorkerProfileSummary(worker) {
    if (!worker)
        return null;
    return {
        id: worker.id,
        status: worker.status,
        warehouseId: worker.warehouseId,
        warehouseCode: worker.warehouse?.code ?? null,
        warehouseName: worker.warehouse?.name ?? null,
        roles: worker.roles.map((r) => r.role),
    };
}
//# sourceMappingURL=user-worker-profile.util.js.map