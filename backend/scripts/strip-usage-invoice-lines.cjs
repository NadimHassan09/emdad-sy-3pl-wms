/**
 * Strip retired usage-based invoice system lines so invoices are fixed-subscription only.
 * Recalculates subtotal / discount / VAT / grand totals for affected invoices.
 *
 * Usage (from backend/, staging DATABASE_URL):
 *   node scripts/strip-usage-invoice-lines.cjs           # dry-run
 *   node scripts/strip-usage-invoice-lines.cjs --apply   # write
 */
'use strict';

const { PrismaClient, Prisma, BillingDiscountType } = require('@prisma/client');

const APPLY = process.argv.includes('--apply');
const prisma = new PrismaClient();

const RETIRED = [
  'inbound',
  'outbound',
  'packaging',
  'quality_check',
  'excess_volume',
  'excess_weight',
];

function computeInvoiceTotals({ subtotalAmount, discountType, discountValue, vatPercentage }) {
  const subtotal = new Prisma.Decimal(subtotalAmount).toDecimalPlaces(2);
  let discountAmount = new Prisma.Decimal(0);

  if (discountType && discountValue != null) {
    const dv = new Prisma.Decimal(discountValue);
    if (discountType === BillingDiscountType.fixed) {
      discountAmount = Prisma.Decimal.min(dv, subtotal).toDecimalPlaces(2);
    } else {
      discountAmount = subtotal.mul(dv).div(100).toDecimalPlaces(2);
    }
  }

  const taxable = subtotal.sub(discountAmount).toDecimalPlaces(2);
  const vatAmount = taxable.mul(vatPercentage).div(100).toDecimalPlaces(2);
  const grandTotal = taxable.add(vatAmount).toDecimalPlaces(2);

  return { subtotalAmount: subtotal, discountAmount, vatAmount, grandTotal };
}

async function main() {
  const retiredLines = await prisma.invoiceLine.findMany({
    where: { lineSource: 'system', type: { in: RETIRED } },
    select: {
      id: true,
      invoiceId: true,
      type: true,
      totalPrice: true,
      invoice: { select: { invoiceNumber: true, grandTotal: true } },
    },
  });

  const byInvoice = new Map();
  for (const line of retiredLines) {
    if (!byInvoice.has(line.invoiceId)) {
      byInvoice.set(line.invoiceId, {
        invoiceNumber: line.invoice.invoiceNumber,
        previousGrandTotal: line.invoice.grandTotal.toString(),
        lines: [],
      });
    }
    byInvoice.get(line.invoiceId).lines.push(line);
  }

  console.log(
    `Found ${retiredLines.length} retired system line(s) across ${byInvoice.size} invoice(s). mode=${APPLY ? 'APPLY' : 'DRY-RUN'}`,
  );

  for (const [invoiceId, info] of byInvoice) {
    const removed = info.lines.reduce(
      (s, l) => s.add(l.totalPrice),
      new Prisma.Decimal(0),
    );
    console.log(
      `  ${info.invoiceNumber}: remove ${info.lines.length} line(s) totaling ${removed.toFixed(2)} (was ${info.previousGrandTotal})`,
    );
  }

  if (!APPLY) {
    console.log('Dry-run only. Re-run with --apply to write.');
    return;
  }

  const invoiceIds = [...byInvoice.keys()];
  if (!invoiceIds.length) {
    console.log('Nothing to update.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.invoiceLine.deleteMany({
      where: { lineSource: 'system', type: { in: RETIRED } },
    });

    for (const invoiceId of invoiceIds) {
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        select: {
          discountType: true,
          discountValue: true,
          vatPercentage: true,
          invoiceNumber: true,
          lines: { select: { totalPrice: true } },
        },
      });
      if (!invoice) continue;

      const subtotalAmount = invoice.lines
        .reduce((sum, line) => sum.add(line.totalPrice), new Prisma.Decimal(0))
        .toDecimalPlaces(2);

      const totals = computeInvoiceTotals({
        subtotalAmount,
        discountType: invoice.discountType,
        discountValue: invoice.discountValue,
        vatPercentage: invoice.vatPercentage,
      });

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          subtotalAmount: totals.subtotalAmount,
          discountAmount: totals.discountAmount,
          vatAmount: totals.vatAmount,
          grandTotal: totals.grandTotal,
          totalAmount: totals.grandTotal,
        },
      });

      console.log(
        `  Updated ${invoice.invoiceNumber} → grandTotal ${totals.grandTotal.toFixed(2)}`,
      );
    }
  });

  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
