import { Prisma, type OmsPaymentMethod } from '@prisma/client';

export interface OmsOrderLineExtras {
  unitPrice?: number;
  lineTotal?: number;
  discountAmount?: number;
}

export interface OmsOrderCreateExtras {
  recipientName?: string;
  recipientPhone?: string;
  city?: string;
  district?: string;
  addressLine1?: string;
  addressLine2?: string;
  deliveryInstructions?: string;
  paymentMethod?: OmsPaymentMethod;
  subtotal?: number;
  shippingFee?: number;
  codAmount?: number;
  currency?: string;
  lineExtras?: OmsOrderLineExtras[];
  warehouseId?: string;
  allocateAfterCreate?: boolean;
  recordOmsEvent?: boolean;
}

export function omsOrderDataFromExtras(
  extras: OmsOrderCreateExtras | undefined,
): Pick<
  Prisma.OutboundOrderUncheckedCreateInput,
  | 'recipientName'
  | 'recipientPhone'
  | 'city'
  | 'district'
  | 'addressLine1'
  | 'addressLine2'
  | 'deliveryInstructions'
  | 'paymentMethod'
  | 'subtotal'
  | 'shippingFee'
  | 'codAmount'
  | 'currency'
  | 'codStatus'
> {
  if (!extras) return {};
  const codPending =
    extras.paymentMethod === 'COD' &&
    extras.codAmount != null &&
    extras.codAmount > 0
      ? ('pending' as const)
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
    subtotal:
      extras.subtotal != null ? new Prisma.Decimal(extras.subtotal) : undefined,
    shippingFee:
      extras.shippingFee != null ? new Prisma.Decimal(extras.shippingFee) : undefined,
    codAmount:
      extras.codAmount != null ? new Prisma.Decimal(extras.codAmount) : undefined,
    currency: extras.currency ?? 'USD',
    codStatus: codPending,
  };
}
