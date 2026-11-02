import { ShippingMethod } from '@prisma/client';

export type BulkSelectionInput = {
  providerCode: string;
  serviceId?: string | null;
  deliveryType?: string | null;
  hubId?: string | null;
  payer?: string | null;
  quotedCurrency?: string | null;
};

export type BulkSelectionPatch = {
  shippingMethod: ShippingMethod;
  shippingProviderCode: string;
  shippingServiceId: string | null;
  shippingHubId: string | null;
  shippingDeliveryType: 'address' | 'hub' | undefined;
  shippingPayer: 'sender' | 'receiver' | 'reseller' | undefined;
  shippingQuotedCurrency: string | null;
};

/** Fields processItem must write before create so batch matches single-order send. */
export function bulkSelectionPatch(input: BulkSelectionInput): BulkSelectionPatch {
  const delivery = (input.deliveryType ?? '').trim().toLowerCase();
  const payer = (input.payer ?? '').trim().toLowerCase();
  return {
    shippingMethod: ShippingMethod.carrier,
    shippingProviderCode: input.providerCode.trim().toUpperCase(),
    shippingServiceId: input.serviceId?.trim() || null,
    shippingHubId: delivery === 'hub' ? input.hubId?.trim() || null : null,
    shippingDeliveryType: delivery === 'hub' ? 'hub' : delivery === 'address' ? 'address' : undefined,
    shippingPayer:
      payer === 'receiver' || payer === 'reseller' || payer === 'sender' ? payer : undefined,
    shippingQuotedCurrency: input.quotedCurrency?.trim() || null,
  };
}
