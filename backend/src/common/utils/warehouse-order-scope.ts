import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

const INBOUND_ACTIVE: Array<
  'draft' | 'pending_approval' | 'confirmed' | 'in_progress' | 'partially_received'
> = ['draft', 'pending_approval', 'confirmed', 'in_progress', 'partially_received'];

const OUTBOUND_ACTIVE: Array<
  | 'draft'
  | 'pending_approval'
  | 'pending_stock'
  | 'confirmed'
  | 'picking'
  | 'packing'
  | 'ready_to_ship'
> = [
  'draft',
  'pending_approval',
  'pending_stock',
  'confirmed',
  'picking',
  'packing',
  'ready_to_ship',
];

/**
 * Orders are not persisted with `warehouse_id`. We scope lists by ledger rows
 * (receive/pick tied to warehouse locations); pipeline orders without any ledger
 * activity remain visible when they match other filters (single-warehouse UI).
 */
export async function inboundIdsVisibleForWarehouse(
  prisma: PrismaService,
  warehouseId: string,
  baseWhere: Prisma.InboundOrderWhereInput,
): Promise<{ id: { in: string[] } }> {
  const locIds = (
    await prisma.location.findMany({
      where: { warehouseId, status: 'active' },
      select: { id: true },
    })
  ).map((l) => l.id);

  const receivedHere =
    locIds.length === 0
      ? []
      : await prisma.inventoryLedger.findMany({
          where: {
            referenceType: 'inbound_order',
            movementType: 'inbound_receive',
            toLocationId: { in: locIds },
          },
          distinct: ['referenceId'],
          select: { referenceId: true },
        });

  const anyInboundReceive = await prisma.inventoryLedger.findMany({
    where: {
      referenceType: 'inbound_order',
      movementType: 'inbound_receive',
    },
    distinct: ['referenceId'],
    select: { referenceId: true },
  });

  const touched = new Set(anyInboundReceive.map((r) => r.referenceId));
  const touchedArray = [...touched];

  const neverReceivedOrders = await prisma.inboundOrder.findMany({
    where: {
      ...baseWhere,
      status: { in: INBOUND_ACTIVE },
      ...(touchedArray.length ? { id: { notIn: touchedArray } } : {}),
    },
    select: { id: true },
  });

  const idSet = new Set<string>(
    [...receivedHere.map((r) => r.referenceId), ...neverReceivedOrders.map((o) => o.id)].filter(Boolean),
  );
  // Always include draft and cancelled orders matching the same tenant filters.
  // Drafts have no receive ledger yet, and cancelled orders may have none at all
  // (and their workflow is torn down on cancel) — neither must be hidden from list UIs.
  const alwaysVisibleRows = await prisma.inboundOrder.findMany({
    where: { ...baseWhere, status: { in: ['draft', 'pending_approval', 'cancelled'] } },
    select: { id: true },
  });
  for (const o of alwaysVisibleRows) idSet.add(o.id);

  return idSet.size ? { id: { in: [...idSet] } } : { id: { in: [] } };
}

export async function outboundIdsVisibleForWarehouse(
  prisma: PrismaService,
  warehouseId: string,
  baseWhere: Prisma.OutboundOrderWhereInput,
): Promise<{ id: { in: string[] } }> {
  const locIds = (
    await prisma.location.findMany({
      where: { warehouseId, status: 'active' },
      select: { id: true },
    })
  ).map((l) => l.id);

  const pickedHere =
    locIds.length === 0
      ? []
      : await prisma.inventoryLedger.findMany({
          where: {
            referenceType: 'outbound_order',
            movementType: 'outbound_pick',
            fromLocationId: { in: locIds },
          },
          distinct: ['referenceId'],
          select: { referenceId: true },
        });

  const anyPick = await prisma.inventoryLedger.findMany({
    where: {
      referenceType: 'outbound_order',
      movementType: 'outbound_pick',
    },
    distinct: ['referenceId'],
    select: { referenceId: true },
  });

  const touched = new Set(anyPick.map((r) => r.referenceId));
  const touchedArray = [...touched];

  const neverPickedOrders = await prisma.outboundOrder.findMany({
    where: {
      ...baseWhere,
      status: { in: OUTBOUND_ACTIVE },
      ...(touchedArray.length ? { id: { notIn: touchedArray } } : {}),
    },
    select: { id: true },
  });

  const idSet = new Set<string>(
    [...pickedHere.map((r) => r.referenceId), ...neverPickedOrders.map((o) => o.id)].filter(Boolean),
  );
  // Always include draft and cancelled orders matching the same tenant filters.
  // Cancelled orders may have no pick ledger and their workflow is removed on
  // cancel, so they would otherwise vanish from list UIs.
  const alwaysVisibleOutRows = await prisma.outboundOrder.findMany({
    where: { ...baseWhere, status: { in: ['draft', 'pending_approval', 'cancelled'] } },
    select: { id: true },
  });
  for (const o of alwaysVisibleOutRows) idSet.add(o.id);

  return idSet.size ? { id: { in: [...idSet] } } : { id: { in: [] } };
}
