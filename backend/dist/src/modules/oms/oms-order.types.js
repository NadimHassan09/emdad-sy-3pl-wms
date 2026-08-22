"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.omsOrderDataFromExtras = omsOrderDataFromExtras;
const client_1 = require("@prisma/client");
function omsOrderDataFromExtras(extras) {
    if (!extras)
        return {};
    const codPending = extras.paymentMethod === 'COD' &&
        extras.codAmount != null &&
        extras.codAmount > 0
        ? 'pending'
        : undefined;
    return {
        recipientName: extras.recipientName,
        recipientPhone: extras.recipientPhone,
        city: extras.city,
        district: extras.district,
        addressLine1: extras.addressLine1,
        addressLine2: extras.addressLine2,
        deliveryInstructions: extras.deliveryInstructions,
        paymentMethod: extras.paymentMethod,
        subtotal: extras.subtotal != null ? new client_1.Prisma.Decimal(extras.subtotal) : undefined,
        shippingFee: extras.shippingFee != null ? new client_1.Prisma.Decimal(extras.shippingFee) : undefined,
        codAmount: extras.codAmount != null ? new client_1.Prisma.Decimal(extras.codAmount) : undefined,
        currency: extras.currency ?? 'USD',
        codStatus: codPending,
    };
}
//# sourceMappingURL=oms-order.types.js.map