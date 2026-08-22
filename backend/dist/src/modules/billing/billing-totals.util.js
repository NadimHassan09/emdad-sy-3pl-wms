"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sumLineTotals = sumLineTotals;
exports.computeInvoiceTotals = computeInvoiceTotals;
const client_1 = require("@prisma/client");
function sumLineTotals(lines) {
    return lines
        .reduce((sum, line) => sum.add(line.totalPrice), new client_1.Prisma.Decimal(0))
        .toDecimalPlaces(2);
}
function computeInvoiceTotals(input) {
    const subtotalAmount = input.subtotalAmount.toDecimalPlaces(2);
    let discountAmount = new client_1.Prisma.Decimal(0);
    if (input.discountType && input.discountValue != null) {
        if (input.discountType === client_1.BillingDiscountType.fixed) {
            discountAmount = client_1.Prisma.Decimal.min(input.discountValue, subtotalAmount).toDecimalPlaces(2);
        }
        else {
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
//# sourceMappingURL=billing-totals.util.js.map