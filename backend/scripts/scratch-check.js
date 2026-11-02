const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const providers = await prisma.shippingProvider.findMany({
    include: { connection: true }
  });
  const shipments = await prisma.carrierShipment.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      providerCode: true,
      externalAwb: true,
      trackingNumber: true,
      status: true,
      lastTrackingStatus: true,
      lastTrackingAt: true,
      createdAt: true,
      rawResultMeta: true,
    }
  });
  console.log("Recent shipments:", JSON.stringify(shipments, null, 2));

  const events = await prisma.carrierShipmentEvent.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      providerCode: true,
      externalEventId: true,
      awb: true,
      eventType: true,
      normalizedStatus: true,
      status: true,
      createdAt: true,
    }
  });
  console.log("Recent events:", JSON.stringify(events, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
