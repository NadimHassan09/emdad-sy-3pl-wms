import { CycleCountLineStatus, CycleCountStatus } from '@prisma/client';

type BlindLocationLine = {
  lineId: string;
  status: CycleCountLineStatus;
  location: {
    id: string;
    name: string;
    fullPath: string;
    barcode: string;
  };
  lot: { id: string; lotNumber: string } | null;
  actualQuantity?: string | null;
  countedAt?: Date | null;
  countNotes?: string | null;
};

export type BlindCycleCountProductGroup = {
  productId: string;
  sku: string;
  name: string;
  barcode: string | null;
  uom: string;
  locations: BlindLocationLine[];
  pendingCount: number;
  completedCount: number;
};

export type BlindCycleCountTask = {
  id: string;
  companyId: string;
  warehouseId: string;
  status: CycleCountStatus;
  blindCount: boolean;
  snapshotAt: Date | null;
  startedAt: Date | null;
  warehouse: { id: string; code: string; name: string };
  progress: {
    totalLines: number;
    pending: number;
    counted: number;
    skipped: number;
  };
  products: BlindCycleCountProductGroup[];
};

type LineRow = {
  id: string;
  status: CycleCountLineStatus;
  actualQuantity: { toString(): string } | null;
  countedAt: Date | null;
  countNotes: string | null;
  product: {
    id: string;
    sku: string;
    name: string;
    barcode: string | null;
    uom: string;
  };
  location: {
    id: string;
    name: string;
    fullPath: string;
    barcode: string;
  };
  lot: { id: string; lotNumber: string } | null;
};

type CountRow = {
  id: string;
  companyId: string;
  warehouseId: string;
  status: CycleCountStatus;
  blindCount: boolean;
  snapshotAt: Date | null;
  startedAt: Date | null;
  warehouse: { id: string; code: string; name: string };
  lines: LineRow[];
};

export function presentBlindCycleCountTask(count: CountRow): BlindCycleCountTask {
  const pending = count.lines.filter((l) => l.status === 'pending').length;
  const counted = count.lines.filter((l) => l.status === 'counted').length;
  const skipped = count.lines.filter((l) => l.status === 'skipped').length;

  const byProduct = new Map<string, BlindCycleCountProductGroup>();

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

    if (line.status === 'pending') group.pendingCount += 1;
    else group.completedCount += 1;

    const loc: BlindLocationLine = {
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

export type BlindCycleCountTaskListItem = {
  id: string;
  warehouse: { id: string; code: string; name: string };
  status: CycleCountStatus;
  snapshotAt: Date | null;
  startedAt: Date | null;
  progress: { totalLines: number; pending: number };
  assignmentScope: 'session' | 'line' | 'pool';
};
