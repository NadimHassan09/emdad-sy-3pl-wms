import { Prisma } from '@prisma/client';

import { compareOmsOrderNumbers, type InstructionPlace } from './oms-instruction-sheet';

export type BatchInstructionPick = {
  productId: string;
  sku: string;
  name: string;
  quantity: string;
  locationName: string;
  locationCode: string;
};

export type BatchInstructionOrder = {
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  /** Tenant / client company name for grouping on packing list. */
  companyName?: string;
  /** Requested units on the order, shown on the checklist. */
  itemCount: string;
  note: string;
  /** Processing orders contribute to picking, allocation, packing, and dispatch. */
  includeOperations: boolean;
  picks: BatchInstructionPick[];
  packingLocation: InstructionPlace | null;
  dispatchLocation: InstructionPlace | null;
};

export type BatchInstructionDocument = {
  batchNumber: string;
  batchName: string;
  createdAtLabel: string;
  createdByName: string;
  orderCount: number;
  unitTotal: string;
  uniqueSkuCount: number;
  pickShort: boolean;
  locations: Array<{
    locationName: string;
    locationCode: string;
    rows: Array<{ sku: string; name: string; quantity: string; orderCount: number }>;
  }>;
  allocations: Array<{
    sku: string;
    name: string;
    total: string;
    splits: Array<{ orderNumber: string; quantity: string }>;
  }>;
  packingGroups: Array<{ place: InstructionPlace | null; orderNumbers: string[] }>;
  dispatchGroups: Array<{ place: InstructionPlace; orderNumbers: string[] }>;
  checklist: Array<{
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    companyName: string;
    itemCount: string;
    note: string;
  }>;
};

function qty(raw: string): Prisma.Decimal {
  try {
    return new Prisma.Decimal(raw || '0');
  } catch {
    return new Prisma.Decimal(0);
  }
}

function formatQty(value: Prisma.Decimal): string {
  const raw = value.toFixed();
  if (!raw.includes('.')) return raw;
  return raw.replace(/\.?0+$/, '');
}

function productKey(pick: BatchInstructionPick): string {
  const id = pick.productId.trim();
  if (id) return `id:${id}`;
  return `label:${pick.sku.trim()}|${pick.name.trim()}`;
}

function placeKey(place: InstructionPlace | null): string {
  if (!place) return 'none';
  return `${place.name.trim()}\u0000${place.code.trim()}`;
}

export function buildBatchInstructionDocument(input: {
  batchNumber: string;
  batchName?: string | null;
  createdAtLabel: string;
  createdByName: string;
  pickShort?: boolean;
  orders: BatchInstructionOrder[];
}): BatchInstructionDocument {
  const orders = [...input.orders].sort((a, b) => compareOmsOrderNumbers(a.orderNumber, b.orderNumber));
  const pickBuckets = new Map<
    string,
    {
      locationName: string;
      locationCode: string;
      sku: string;
      name: string;
      quantity: Prisma.Decimal;
      orders: Set<string>;
    }
  >();
  const allocBuckets = new Map<
    string,
    {
      sku: string;
      name: string;
      total: Prisma.Decimal;
      splits: Map<string, Prisma.Decimal>;
    }
  >();

  let unitTotal = new Prisma.Decimal(0);
  const packing = new Map<string, { place: InstructionPlace | null; orderNumbers: string[] }>();
  const dispatch = new Map<string, { place: InstructionPlace; orderNumbers: string[] }>();

  for (const order of orders) {
    if (!order.includeOperations) continue;
    const packKey = placeKey(order.packingLocation);
    const packGroup = packing.get(packKey) ?? { place: order.packingLocation, orderNumbers: [] };
    packGroup.orderNumbers.push(order.orderNumber);
    packing.set(packKey, packGroup);

    if (order.dispatchLocation) {
      const dockKey = placeKey(order.dispatchLocation);
      const dockGroup = dispatch.get(dockKey) ?? { place: order.dispatchLocation, orderNumbers: [] };
      dockGroup.orderNumbers.push(order.orderNumber);
      dispatch.set(dockKey, dockGroup);
    }

    for (const pick of order.picks) {
      const amount = qty(pick.quantity);
      if (amount.lessThanOrEqualTo(0)) continue;
      unitTotal = unitTotal.plus(amount);
      const locationName = pick.locationName.trim() || '—';
      const locationCode = pick.locationCode.trim();
      const sku = pick.sku.trim() || '—';
      const name = pick.name.trim() || '—';
      const pickKey = `${productKey(pick)}\u0000${locationName}\u0000${locationCode}`;
      const bucket = pickBuckets.get(pickKey) ?? {
        locationName,
        locationCode,
        sku,
        name,
        quantity: new Prisma.Decimal(0),
        orders: new Set<string>(),
      };
      bucket.quantity = bucket.quantity.plus(amount);
      bucket.orders.add(order.orderNumber);
      pickBuckets.set(pickKey, bucket);

      const allocKey = productKey({ ...pick, sku, name });
      const alloc = allocBuckets.get(allocKey) ?? {
        sku,
        name,
        total: new Prisma.Decimal(0),
        splits: new Map<string, Prisma.Decimal>(),
      };
      alloc.total = alloc.total.plus(amount);
      alloc.splits.set(order.orderNumber, (alloc.splits.get(order.orderNumber) ?? new Prisma.Decimal(0)).plus(amount));
      allocBuckets.set(allocKey, alloc);
    }
  }

  const locationMap = new Map<string, BatchInstructionDocument['locations'][number]>();
  for (const bucket of pickBuckets.values()) {
    const key = `${bucket.locationName}\u0000${bucket.locationCode}`;
    const group = locationMap.get(key) ?? {
      locationName: bucket.locationName,
      locationCode: bucket.locationCode,
      rows: [],
    };
    group.rows.push({
      sku: bucket.sku,
      name: bucket.name,
      quantity: formatQty(bucket.quantity),
      orderCount: bucket.orders.size,
    });
    locationMap.set(key, group);
  }
  const locations = [...locationMap.values()]
    .map((group) => ({
      ...group,
      rows: group.rows.sort((a, b) => a.sku.localeCompare(b.sku) || a.name.localeCompare(b.name)),
    }))
    .sort(
      (a, b) =>
        a.locationName.localeCompare(b.locationName) || a.locationCode.localeCompare(b.locationCode),
    );

  const allocations = [...allocBuckets.values()]
    .map((bucket) => ({
      sku: bucket.sku,
      name: bucket.name,
      total: formatQty(bucket.total),
      splits: [...bucket.splits.entries()]
        .map(([orderNumber, quantity]) => ({ orderNumber, quantity: formatQty(quantity) }))
        .sort((a, b) => compareOmsOrderNumbers(a.orderNumber, b.orderNumber)),
    }))
    .sort((a, b) => a.sku.localeCompare(b.sku) || a.name.localeCompare(b.name));

  return {
    batchNumber: input.batchNumber,
    batchName: input.batchName?.trim() || '',
    createdAtLabel: input.createdAtLabel,
    createdByName: input.createdByName,
    orderCount: orders.length,
    unitTotal: formatQty(unitTotal),
    uniqueSkuCount: allocations.length,
    pickShort: Boolean(input.pickShort),
    locations,
    allocations,
    packingGroups: [...packing.values()],
    dispatchGroups: [...dispatch.values()],
    checklist: orders.map((order) => ({
      orderNumber: order.orderNumber,
      customerName: order.customerName || '—',
      customerPhone: order.customerPhone?.trim() || '—',
      companyName: order.companyName?.trim() || '—',
      itemCount: order.itemCount || '0',
      note: order.note.trim() || '—',
    })),
  };
}
