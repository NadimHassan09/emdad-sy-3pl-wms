import { PrismaClient, OmsOrderStatus, OutboundOrderStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== STARTING OMS READY TO SHIP RECONCILIATION (STAGING ONLY) ===\n');

  // Find all orders where main status is processing but outbound order is in shipping preparation
  const eligibleOrders = await prisma.omsOrder.findMany({
    where: {
      status: OmsOrderStatus.processing,
      outboundOrder: {
        status: {
          in: [
            OutboundOrderStatus.waiting_for_shipping_method,
            OutboundOrderStatus.waiting_for_shipping_details,
            OutboundOrderStatus.ready_to_ship,
          ],
        },
      },
    },
    include: {
      outboundOrder: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          trackingNumber: true,
        },
      },
    },
  });

  console.log(`Found ${eligibleOrders.length} inconsistent order(s) (status=processing, outbound in shipping stage):\n`);

  const reconciled: Array<{
    omsOrderId: string;
    orderNumber: string;
    beforeStatus: string;
    afterStatus: string;
    outboundOrderId: string;
    outboundOrderNumber: string;
    outboundStatus: string;
  }> = [];

  for (const order of eligibleOrders) {
    const outbound = order.outboundOrder;
    if (!outbound) continue;

    console.log(`Reconciling order ${order.orderNumber} (${order.id}):`);
    console.log(`  - OMS Status: ${order.status} -> ${OmsOrderStatus.ready_to_ship}`);
    console.log(`  - Outbound Status: ${outbound.status} (${outbound.orderNumber})`);

    await prisma.$transaction(async (tx) => {
      // 1. Update OMS order status
      await tx.omsOrder.update({
        where: { id: order.id },
        data: {
          status: OmsOrderStatus.ready_to_ship,
        },
      });

      // 2. Append event history
      await tx.omsOrderEvent.create({
        data: {
          omsOrderId: order.id,
          outboundOrderId: outbound.id,
          companyId: order.companyId,
          eventType: 'oms.ready_to_ship',
          payload: {
            source: 'reconciliation_migration',
            reason: 'Enforce Ready to Ship lifecycle for shipping preparation',
            previousStatus: order.status,
            newStatus: OmsOrderStatus.ready_to_ship,
            outboundStatus: outbound.status,
          },
        },
      });
    });

    reconciled.push({
      omsOrderId: order.id,
      orderNumber: order.orderNumber,
      beforeStatus: order.status,
      afterStatus: OmsOrderStatus.ready_to_ship,
      outboundOrderId: outbound.id,
      outboundOrderNumber: outbound.orderNumber,
      outboundStatus: outbound.status,
    });

    console.log(`  ✓ Reconciled successfully\n`);
  }

  // Also check inverse inconsistency
  const inverseInconsistent = await prisma.omsOrder.findMany({
    where: {
      status: OmsOrderStatus.ready_to_ship,
      OR: [
        {
          outboundOrder: {
            status: {
              in: [
                OutboundOrderStatus.picking,
                OutboundOrderStatus.packing,
                OutboundOrderStatus.allocated,
                OutboundOrderStatus.confirmed,
                OutboundOrderStatus.draft,
                OutboundOrderStatus.pending_stock,
                OutboundOrderStatus.pending_approval,
              ],
            },
          },
        },
        { outboundOrderId: null },
      ],
    },
    include: {
      outboundOrder: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
        },
      },
    },
  });

  console.log(`Checked inverse inconsistencies: found ${inverseInconsistent.length} orders.`);
  if (inverseInconsistent.length > 0) {
    for (const inv of inverseInconsistent) {
      console.log(`  - Warning: Order ${inv.orderNumber} has status ready_to_ship but outbound status is ${inv.outboundOrder?.status ?? 'null'}`);
    }
  }

  console.log('\n=== RECONCILIATION SUMMARY ===');
  console.log(`Total orders reconciled: ${reconciled.length}`);
  console.table(reconciled);
}

main()
  .catch((e) => {
    console.error('Reconciliation failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
