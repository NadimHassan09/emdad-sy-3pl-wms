"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitForOpenWarehouseTask = waitForOpenWarehouseTask;
exports.buildAdminPickCompleteBody = buildAdminPickCompleteBody;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
async function waitForOpenWarehouseTask(prisma, referenceType, referenceId, taskType) {
    for (let i = 0; i < 8; i++) {
        const t = await prisma.warehouseTask.findFirst({
            where: {
                taskType,
                status: {
                    in: [
                        client_1.WarehouseTaskStatus.pending,
                        client_1.WarehouseTaskStatus.assigned,
                        client_1.WarehouseTaskStatus.in_progress,
                    ],
                },
                workflowInstance: { referenceType, referenceId },
            },
            orderBy: { createdAt: 'desc' },
            select: { id: true, executionState: true },
        });
        if (t)
            return t;
        await new Promise((r) => setTimeout(r, 50 * (i + 1)));
    }
    throw new common_1.BadRequestException(`Expected open ${taskType} task was not created for ${referenceType} ${referenceId}.`);
}
function buildAdminPickCompleteBody(executionState) {
    const exec = executionState && typeof executionState === 'object' && !Array.isArray(executionState)
        ? executionState
        : {};
    const reservations = Array.isArray(exec.reservations) ? exec.reservations : [];
    if (reservations.length === 0) {
        throw new common_1.BadRequestException('No FEFO reservations on pick task (stock may be insufficient).');
    }
    const pickGroups = new Map();
    for (const raw of reservations) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw))
            continue;
        const row = raw;
        const lineId = typeof row.outboundOrderLineId === 'string'
            ? row.outboundOrderLineId
            : typeof row.outbound_order_line_id === 'string'
                ? row.outbound_order_line_id
                : null;
        const locationId = typeof row.locationId === 'string'
            ? row.locationId
            : typeof row.location_id === 'string'
                ? row.location_id
                : null;
        const qty = row.quantity != null
            ? String(row.quantity)
            : row.qty != null
                ? String(row.qty)
                : null;
        if (!lineId || !locationId || !qty)
            continue;
        const lotRaw = row.lotId ?? row.lot_id;
        const lotId = lotRaw == null || lotRaw === '' ? null : String(lotRaw);
        const g = pickGroups.get(lineId) ?? [];
        g.push({ location_id: locationId, lot_id: lotId, quantity: qty });
        pickGroups.set(lineId, g);
    }
    if (pickGroups.size === 0) {
        throw new common_1.BadRequestException('Could not build pick completion payload from reservations.');
    }
    return {
        task_type: 'pick',
        picks: [...pickGroups.entries()].map(([outbound_order_line_id, lines]) => ({
            outbound_order_line_id,
            lines,
        })),
    };
}
//# sourceMappingURL=outbound-admin-task.helpers.js.map