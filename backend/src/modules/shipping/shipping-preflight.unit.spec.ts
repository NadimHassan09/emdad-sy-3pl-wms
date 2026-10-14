import { VERIFIED_TARABUT_COURIER_ID } from './provider-cod';
import { BABEL_EXPRESS_CODE, SILA_SY_CODE } from './shipping.constants';
import { preflightCarrierShipment } from './shipping-preflight';

const base = {
  reference: 'OMS-ACME-1',
  receiverName: 'مستلم تجريبي',
  receiverPhone: '944000111',
  receiverCity: 'حمص',
  receiverNeighborhood: 'الأرمن',
  senderName: 'مستودعات إمداد',
  senderPhone: '0996003448',
  senderNeighborhood: 'الشيخ نجار',
  senderNeighborhoodId: 436,
  senderLat: 36.28,
  senderLng: 37.24,
  weightKg: 1,
};

describe('preflightCarrierShipment', () => {
  it('builds the Babel payload with payer and COD currency passed through', () => {
    const result = preflightCarrierShipment({
      ...base,
      providerCode: BABEL_EXPRESS_CODE,
      payer: 'receiver',
      codAmount: 26,
      codCurrency: 'USD',
      pickupType: 'address',
      deliveryType: 'hub',
      serviceId: 'BABEL_EXPRESS:hub',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const shipment = result.payload.shipment as {
      payer: string;
      cod: { amount: number; currency: string };
      sender: { neighbourhood: { id: number } };
    };
    expect(shipment.payer).toBe('receiver');
    expect(shipment.cod).toEqual({ amount: 26, currency: 'USD' });
    expect(shipment.sender.neighbourhood).toEqual({ id: 436 });
  });

  it('does not block Babel locally when the sender neighbourhood or payer is unresolved', () => {
    const missingHood = preflightCarrierShipment({
      ...base,
      providerCode: BABEL_EXPRESS_CODE,
      payer: 'sender',
      codAmount: 0,
      codCurrency: 'USD',
      senderNeighborhoodId: null,
      senderLat: undefined,
      senderLng: undefined,
      pickupType: 'address',
    });
    expect(missingHood.ok).toBe(true);

    const sender = preflightCarrierShipment({
      ...base,
      providerCode: BABEL_EXPRESS_CODE,
      payer: 'sender',
      codAmount: 58,
      codCurrency: 'USD',
      pickupType: 'address',
      deliveryType: 'address',
    });
    expect(sender.ok).toBe(true);
  });

  it('does not invent a Babel SYP minimum before the carrier responds', () => {
    const low = preflightCarrierShipment({
      ...base,
      providerCode: BABEL_EXPRESS_CODE,
      payer: 'receiver',
      codAmount: 26,
      codCurrency: 'USD',
      deliveryType: 'hub',
      serviceId: 'BABEL_EXPRESS:hub',
    });
    expect(low.ok).toBe(true);
    if (!low.ok) return;
    const shipment = low.payload.shipment as { cod: { amount: number; currency: string } };
    expect(shipment.cod).toEqual({ amount: 26, currency: 'USD' });
  });

  it('builds the observed Sila payload: merchant payer, city district, home delivery', () => {
    const result = preflightCarrierShipment({
      ...base,
      providerCode: SILA_SY_CODE,
      payer: 'sender',
      codAmount: 150,
      codCurrency: 'USD',
      quoteCurrency: 'SYP',
      deliveryType: 'address',
      serviceId: `SILA_SY:${VERIFIED_TARABUT_COURIER_ID}:area`,
      serviceName: 'TARABUT',
      pickupType: 'address',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload).toMatchObject({
      provider: SILA_SY_CODE,
      evidence: 'observed',
      shipping_paid_by: 'merchant',
      currency: 'USD',
      codAmount: 150,
      districtSource: 'city',
      district: 'حمص',
      service_type: 'home_delivery',
    });
  });

  it('does not apply Babel location or COD whitelist rules to Sila', () => {
    const reseller = preflightCarrierShipment({
      ...base,
      providerCode: SILA_SY_CODE,
      payer: 'reseller',
      codAmount: 0,
      codCurrency: 'SYP',
    });
    expect(reseller.ok).toBe(true);

    const currency = preflightCarrierShipment({
      ...base,
      providerCode: SILA_SY_CODE,
      payer: 'sender',
      codAmount: 26,
      codCurrency: 'USD',
      quoteCurrency: 'SYP',
      deliveryType: 'address',
      serviceName: 'Other Courier',
    });
    expect(currency.ok).toBe(true);

    const area = preflightCarrierShipment({
      ...base,
      providerCode: SILA_SY_CODE,
      payer: 'sender',
      codAmount: 0,
      receiverCity: '',
      receiverNeighborhood: '',
    });
    expect(area.ok).toBe(true);
  });
});
