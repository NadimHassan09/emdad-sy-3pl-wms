import { BillingDiscountType, Prisma } from '@prisma/client';

export type InvoiceTotalsInput = {
  subtotalAmount: Prisma.Decimal;
  discountType: BillingDiscountType | null;
  discountValue: Prisma.Decimal | null;
  vatPercentage: Prisma.Decimal;
};

export function sumLineTotals(lines: { totalPrice: Prisma.Decimal }[]): Prisma.Decimal {
  return lines
    .reduce((sum, line) => sum.add(line.totalPrice), new Prisma.Decimal(0))
    .toDecimalPlaces(2);
}

export function computeInvoiceTotals(input: InvoiceTotalsInput) {
  const subtotalAmount = input.subtotalAmount.toDecimalPlaces(2);
  let discountAmount = new Prisma.Decimal(0);

  if (input.discountType && input.discountValue != null) {
    if (input.discountType === BillingDiscountType.fixed) {
      discountAmount = Prisma.Decimal.min(input.discountValue, subtotalAmount).toDecimalPlaces(2);
    } else {
      discountAmount = subtotalAmount.mul(input.discountValue).div(100).toDecimalPlaces(2);
    }
  }

  const taxableAmount = subtotalAmount.sub(discountAmount).toDecimalPlaces(2);
  const vatAmount = taxableAmount.mul(input.vatPercentage).div(100).toDecimalPlaces(2);
  const grandTotal = taxableAmount.add(vatAmount).toDecimalPlaces(2);

  return {
    subtotalAmount,
    discountAmount,
    vatAmount,
    grandTotal,
    taxableAmount,
  };
}
