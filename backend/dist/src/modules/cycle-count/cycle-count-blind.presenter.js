"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.presentBlindCycleCountTask = presentBlindCycleCountTask;
function presentBlindCycleCountTask(count) {
    const pending = count.lines.filter((l) => l.status === 'pending').length;
    const counted = count.lines.filter((l) => l.status === 'counted').length;
    const skipped = count.lines.filter((l) => l.status === 'skipped').length;
    const byProduct = new Map();
    for (const line of count.lines) {
        let group = byProduct.get(line.product.id);
        if (!group) {
            group = {
                productId: line.product.id,
                sku: line.product.sku,
                name: line.product.name,
                barcode: line.product.barcode,
                uom: line.product.uom,
                locations: [],
                pendingCount: 0,
                completedCount: 0,
            };
            byProduct.set(line.product.id, group);
        }
        if (line.status === 'pending')
            group.pendingCount += 1;
        else
            group.completedCount += 1;
        const loc = {
            lineId: line.id,
            status: line.status,
            location: line.location,
            lot: line.lot,
            countedAt: line.countedAt,
            countNotes: line.countNotes,
        };
        if (line.status === 'counted' && line.actualQuantity != null) {
            loc.actualQuantity = line.actualQuantity.toString();
        }
        group.locations.push(loc);
    }
    const products = [...byProduct.values()].sort((a, b) => a.sku.localeCompare(b.sku));
    for (const p of products) {
        p.locations.sort((a, b) => a.location.fullPath.localeCompare(b.location.fullPath));
    }
    return {
        id: count.id,
        companyId: count.companyId,
        warehouseId: count.warehouseId,
        status: count.status,
        blindCount: count.blindCount,
        snapshotAt: count.snapshotAt,
        startedAt: count.startedAt,
        warehouse: count.warehouse,
        progress: {
            totalLines: count.lines.length,
            pending,
            counted,
            skipped,
        },
        products,
    };
}
//# sourceMappingURL=cycle-count-blind.presenter.js.map