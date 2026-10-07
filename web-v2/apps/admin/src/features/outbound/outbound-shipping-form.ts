import type { OutboundOrder } from '@/api/outbound'
import type { ShippingMethod, ShippingPackageType } from '@/api/shipping'

export type OutboundShippingDraft = {
  shippingMethod: ShippingMethod
  shippingProviderCode: string
  carrier: string
  trackingNumber: string
  city: string
  district: string
  addressLine1: string
  addressLine2: string
  shippingPackageType: ShippingPackageType | ''
  shippingWeightKg: string
  shippingContents: string
}

export function shippingDraftFromOrder(order: OutboundOrder): OutboundShippingDraft {
  return {
    shippingMethod: order.shippingMethod === 'manual' ? 'manual' : 'carrier',
    shippingProviderCode: order.shippingProviderCode?.trim() ?? '',
    carrier: order.carrier?.trim() ?? '',
    trackingNumber: order.trackingNumber?.trim() ?? '',
    city: order.city?.trim() ?? '',
    district: order.district?.trim() ?? '',
    addressLine1: order.addressLine1?.trim() ?? '',
    addressLine2: order.addressLine2?.trim() ?? '',
    shippingPackageType:
      order.shippingPackageType === 'box' || order.shippingPackageType === 'envelope'
        ? order.shippingPackageType
        : 'box',
    shippingWeightKg:
      order.shippingWeightKg != null && order.shippingWeightKg !== ''
        ? String(order.shippingWeightKg)
        : '',
    shippingContents: order.shippingContents?.trim() ?? '',
  }
}

export function shippingDraftToPayload(draft: OutboundShippingDraft) {
  const weight = draft.shippingWeightKg.trim() ? Number(draft.shippingWeightKg) : undefined
  return {
    shippingMethod: draft.shippingMethod,
    shippingProviderCode: draft.shippingProviderCode.trim() || undefined,
    carrier: draft.carrier.trim() || null,
    trackingNumber: draft.trackingNumber.trim() || null,
    city: draft.city.trim() || null,
    district: draft.district.trim() || null,
    addressLine1: draft.addressLine1.trim() || null,
    addressLine2: draft.addressLine2.trim() || null,
    shippingPackageType: draft.shippingPackageType || undefined,
    shippingWeightKg: Number.isFinite(weight) ? weight : undefined,
    shippingContents: draft.shippingContents.trim() || undefined,
  }
}
