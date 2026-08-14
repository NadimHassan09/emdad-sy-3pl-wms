/**
 * Staging report for OMS historical rows left on legacy/ambiguous statuses
 * after evidence-based migration.
 *
 * Usage (staging only):
 *   cd backend && npx ts-node -r tsconfig-paths/register scripts/oms-workflow-migration-report.ts
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const PRIMARY = new Set([
  'waiting_for_confirmation',
  'confirmed_waiting_for_admin_approval',
  'processing',
  'ready_to_ship',
  'shipped',
  'delivered',
  'cancelled',
  'failed_delivery',
  'returned',
]);

async function main() {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      order_number: string;
      status: string;
      outbound_order_id: string | null;
      outbound_status: string | null;
      approved_at: Date | null;
      confirmed_at: Date | null;
      created_by_role: string | null;
    }>
  >`
    SELECT
      o.id,
      o.order_number,
      o.status::text AS status,
      o.outbound_order_id,
      oo.status::text AS outbound_status,
      o.approved_at,
      o.confirmed_at,
      u.role::text AS created_by_role
    FROM oms_orders o
    LEFT JOIN outbound_orders oo ON oo.id = o.outbound_order_id
    LEFT JOIN users u ON u.id = o.created_by
    WHERE o.status::text NOT IN (
      'waiting_for_confirmation',
      'confirmed_waiting_for_admin_approval',
      'processing',
      'ready_to_ship',
      'shipped',
      'delivered',
      'cancelled',
      'failed_delivery',
      'returned'
    )
    ORDER BY o.created_at DESC
  `;

  const outDir = path.resolve(__dirname, '../../docs/logs');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(
    outDir,
    `oms-workflow-ambiguous-${new Date().toISOString().slice(0, 10)}.csv`,
  );

  const header =
    'omsOrderId,orderNumber,oldStatus,outboundId,outboundStatus,approvedAt,confirmedAt,createdByRole,reason\n';
  const lines = rows.map((r) => {
    const reason = !PRIMARY.has(r.status)
      ? 'legacy_or_ambiguous_left_unchanged'
      : 'ok';
    return [
      r.id,
      r.order_number,
      r.status,
      r.outbound_order_id ?? '',
      r.outbound_status ?? '',
      r.approved_at?.toISOString() ?? '',
      r.confirmed_at?.toISOString() ?? '',
      r.created_by_role ?? '',
      reason,
    ]
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(',');
  });

  fs.writeFileSync(outPath, header + lines.join('\n') + '\n', 'utf8');
  console.log(`Wrote ${rows.length} ambiguous/legacy rows to ${outPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
