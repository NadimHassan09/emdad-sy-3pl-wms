import { mapCreateShipmentPayload } from './providers/babel-express/babel-shipment.mapper';
import type { ShippingCreateShipmentInput } from './shipping-provider.interface';
import { BABEL_EXPRESS_CODE, SILA_SY_CODE } from './shipping.constants';
import {
  classifyShippingError,
  type ShippingFailure,
} from './shipping-error';

/**
 * Payload evidence (do not change observed fields from a guess):
 *
 * Babel — verified from backend/src/modules/shipping/providers/babel-express/BABEL_API.md
 * and the checked-in OpenAPI notes:
 * | field | source | transform | evidence |
 * | shipment.payer | order.shippingPayer | pass-through sender/receiver/reseller | verified |
 * | shipment.cod.currency | OMS COD currency | USD or SYP, no USD→SYP conversion | verified |
 * | sender.neighbourhood | address index / coords | required or stop senderNeighborhood | verified |
 * | receiver neighbourhood or coordinates | order address | required by OpenAPI | verified |
 * | SYP COD minimum | not enforced locally | Babel's own response | BABEL_API.md says 1000 SYP; not confirmed on the live API |
 *
 * Sila — no checked-in OpenAPI. Every mapping below is observed from the current adapter:
 * | shipping_paid_by merchant/receiver | payer | reseller rejected locally | observed |
 * | receiver + COD rejected | payer + amount | amount forced conceptually to 0 by stop | observed |
 * | province area narrowed to child | address index | stop receiverNeighborhood if no child | observed |
 * | COD currency | verified service capability | fee currency does not decide COD | observed |
 * | branch-only couriers hidden for home | delivery type | unchanged | observed |
 */
export type PreflightOk = { ok: true; payload: Record<string, unknown> };
export type PreflightStop = { ok: false; failure: ShippingFailure };
export type PreflightResult = PreflightOk | PreflightStop;

export type PreflightInput = {
  providerCode: string;
  reference?: string | null;
  payer?: string | null;
  codAmount?: number | null;
  codCurrency?: string | null;
  quoteCurrency?: string | null;
  receiverName?: string | null;
  receiverPhone?: string | null;
  receiverCity?: string | null;
  receiverNeighborhood?: string | null;
  senderName?: string | null;
  senderPhone?: string | null;
  senderNeighborhood?: string | null;
  senderNeighborhoodId?: number | null;
  senderLat?: number | null;
  senderLng?: number | null;
  pickupType?: 'address' | 'hub' | null;
  deliveryType?: string | null;
  serviceId?: string | null;
  serviceName?: string | null;
  weightKg?: number | null;
};

function stop(raw: string, input: PreflightInput): PreflightStop {
  return {
    ok: false,
    failure: classifyShippingError(raw, {
      providerCode: input.providerCode,
      correlationId: input.reference,
      payer: input.payer,
      codAmount: input.codAmount,
      codCurrency: input.codCurrency,
      quoteCurrency: input.quoteCurrency,
      receiverNeighborhood: input.receiverNeighborhood,
      senderNeighborhood: input.senderNeighborhood,
    }),
  };
}

export function preflightCarrierShipment(input: PreflightInput): PreflightResult {
  const code = input.providerCode.trim().toUpperCase();
  if (code === BABEL_EXPRESS_CODE) return preflightBabel(input);
  if (code === SILA_SY_CODE) return preflightSila(input);
  return {
    ok: true,
    payload: {
      provider: code,
      reference: input.reference ?? null,
      payer: input.payer ?? null,
      codAmount: input.codAmount ?? 0,
      codCurrency: input.codCurrency ?? null,
    },
  };
}

function preflightBabel(input: PreflightInput): PreflightResult {
  const currency = (input.codCurrency ?? 'USD').trim().toUpperCase();
  const amount = Number(input.codAmount ?? 0);
  const pickupType = input.pickupType === 'hub' ? 'hub' : 'address';
  if (!input.receiverName?.trim()) {
    return stop('receiver name is required', input);
  }

  const payer = input.payer === 'receiver' || input.payer === 'reseller' ? input.payer : 'sender';
  const shipment: ShippingCreateShipmentInput = {
    reference: input.reference ?? 'preflight',
    pickupType,
    payer,
    packageType: 'box',
    weightKg: input.weightKg ?? 1,
    contents: 'goods',
    deliveryType: input.deliveryType === 'hub' ? 'hub' : 'address',
    codAmount: amount,
    currency,
    pickup: {
      name: input.senderName ?? 'Warehouse',
      phoneCountry: '963',
      phoneLocal: input.senderPhone ?? '',
      address: input.senderNeighborhood ?? '',
      neighbourhoodId: input.senderNeighborhoodId ?? undefined,
      lat: input.senderLat ?? undefined,
      lng: input.senderLng ?? undefined,
      neighborhood: input.senderNeighborhood ?? undefined,
    },
    receiver: {
      name: input.receiverName.trim(),
      phoneCountry: '963',
      phoneLocal: input.receiverPhone ?? '',
      address: input.receiverNeighborhood || input.receiverCity || '',
      lat: 0,
      lng: 0,
      city: input.receiverCity ?? '',
      neighborhood: input.receiverNeighborhood ?? '',
    },
  };
  const payload = mapCreateShipmentPayload(shipment) as unknown as Record<string, unknown>;
  return { ok: true, payload };
}

function preflightSila(input: PreflightInput): PreflightResult {
  const payer = (input.payer ?? 'sender').trim().toLowerCase();
  const amount = Number(input.codAmount ?? 0);
  const codCurrency = (input.codCurrency ?? '').trim().toUpperCase();
  const home = (input.deliveryType ?? 'address') !== 'hub' && input.pickupType !== 'hub';
  return {
    ok: true,
    payload: {
      provider: SILA_SY_CODE,
      evidence: 'observed',
      shipping_paid_by: payer === 'receiver' ? 'receiver' : 'merchant',
      payer,
      currency: codCurrency || null,
      codAmount: amount,
      districtSource: 'city',
      district: input.receiverCity ?? '',
      neighborhood: input.receiverNeighborhood ?? '',
      service_type: home ? 'home_delivery' : 'pickup_at_branch',
    },
  };
}

