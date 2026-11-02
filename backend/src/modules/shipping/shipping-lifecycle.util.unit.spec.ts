import {
  ACTIVE_CARRIER_SHIPMENT_WHERE,
  carrierUnlinkPatch,
  confirmedCourierReassignment,
  isSilaPendingCancelMeta,
  mayUnlockToShippingDetails,
  normalizeWaybillScanCode,
  omsStatusAfterPreDispatchUnlock,
  outboundStatusAfterPreDispatchUnlock,
  pickActiveCarrierShipment,
  requireHubSelection,
  shipmentSendGuard,
  shouldApplyTrackingToOrder,
  waybillScanAttempts,
} from './shipping-lifecycle.util';
import {
  createQuoteFingerprint,
  isQuoteFingerprintFresh,
} from './quote-freshness';

describe('shipping lifecycle helpers', () => {
  it('unlocks Waiting for Shipping Confirmation and Ready to Ship only', () => {
    expect(mayUnlockToShippingDetails('processing')).toBe(true);
    expect(mayUnlockToShippingDetails('ready_to_ship')).toBe(true);
    expect(mayUnlockToShippingDetails('out_for_delivery')).toBe(false);
    expect(mayUnlockToShippingDetails('delivered')).toBe(false);
    expect(mayUnlockToShippingDetails('returned')).toBe(false);
    expect(omsStatusAfterPreDispatchUnlock('ready_to_ship')).toBe('ready_to_ship');
    expect(omsStatusAfterPreDispatchUnlock('processing')).toBe('processing');
    expect(outboundStatusAfterPreDispatchUnlock('ready_to_ship')).toBe(
      'waiting_for_shipping_details',
    );
    expect(outboundStatusAfterPreDispatchUnlock('waiting_for_shipping_details')).toBe(
      'waiting_for_shipping_details',
    );
  });

  it('clears live carrier fields while leaving audit to the superseded shipment', () => {
    expect(carrierUnlinkPatch()).toEqual({
      trackingNumber: null,
      carrier: null,
      shippingProviderCode: null,
      shippingServiceId: null,
      shippingHubId: null,
    });
  });

  it('treats Sila pending_confirmation as not definitive', () => {
    expect(isSilaPendingCancelMeta({ silaCancel: { state: 'pending_confirmation' } })).toBe(true);
    expect(isSilaPendingCancelMeta({ silaCancel: { state: 'confirmed' } })).toBe(false);
  });

  it('ignores failed/superseded shipments and duplicate return effects', () => {
    expect(shouldApplyTrackingToOrder({ status: 'created', supersededAt: null })).toBe(true);
    expect(shouldApplyTrackingToOrder({ status: 'failed', supersededAt: new Date() })).toBe(false);
    expect(shouldApplyTrackingToOrder({ status: 'created', supersededAt: new Date() })).toBe(false);
    expect(
      pickActiveCarrierShipment([
        { status: 'failed', supersededAt: new Date(), trackingNumber: 'OLD' },
        { status: 'created', supersededAt: null, trackingNumber: 'NEW' },
      ])?.trackingNumber,
    ).toBe('NEW');
    expect(ACTIVE_CARRIER_SHIPMENT_WHERE.status.notIn).toEqual(
      expect.arrayContaining(['failed']),
    );
    expect(normalizeWaybillScanCode(' EMD-OMS-1 ')).toBe('EMD-OMS-1');
    expect(waybillScanAttempts('EMD-OMS-1')).toEqual(['EMD-OMS-1', 'OMS-1']);
  });

  it('updates the live courier only from confirmed provider identity', () => {
    expect(
      confirmedCourierReassignment({
        storedCourierId: 'old-id',
        storedCarrierName: 'Masarat',
        confirmed: { courierId: 'new-id', courierName: 'Tarabut' },
      }).changed,
    ).toBe(true);
    expect(
      confirmedCourierReassignment({
        storedCourierId: 'same-id',
        storedCarrierName: 'Masarat',
        confirmed: { courierId: 'same-id', courierName: 'Masarat' },
      }).changed,
    ).toBe(false);
    expect(
      confirmedCourierReassignment({
        storedCourierId: 'same-id',
        storedCarrierName: 'Masarat',
        confirmed: { courierId: null, courierName: null },
      }).changed,
    ).toBe(false);
    expect(
      confirmedCourierReassignment({
        storedCourierId: 'fd4f088d-243b-4582-bb72-bb97c69b589c',
        storedCarrierName: 'TARABUT',
        confirmed: {
          courierId: 'fd4f088d-243b-4582-bb72-bb97c69b589c',
          courierName: 'ترابط',
        },
      }).changed,
    ).toBe(false);
    expect(
      confirmedCourierReassignment({
        storedCourierId: 'fd4f088d-243b-4582-bb72-bb97c69b589c',
        storedCarrierName: 'TARABUT',
        confirmed: {
          courierId: '9575208d-3587-4d23-84b3-cdc97d09b60e',
          courierName: 'Karam',
        },
      }).changed,
    ).toBe(true);
  });

  it('requires an explicit hub when nearest cannot be determined', () => {
    expect(
      requireHubSelection({
        deliveryType: 'hub',
        hubs: [{ id: 'a' }, { id: 'b' }],
        selectedHubId: null,
        nearestDetermined: false,
      }),
    ).toMatch(/select a delivery hub/i);
    expect(
      requireHubSelection({
        deliveryType: 'address',
        hubs: [{ id: 'a' }],
        selectedHubId: null,
        nearestDetermined: false,
      }),
    ).toBeNull();
  });

  it('blocks send on quote failure, stale hub quote, and missing hub', () => {
    expect(
      shipmentSendGuard({
        quoteError: 'Carrier quote failed',
        deliveryType: 'hub',
        selectedHubId: 'hub-1',
        fingerprintHubId: 'hub-1',
      }),
    ).toBe('Carrier quote failed');
    expect(
      shipmentSendGuard({
        deliveryType: 'hub',
        selectedHubId: 'hub-2',
        fingerprintHubId: 'hub-1',
        hubs: [{ id: 'hub-1' }, { id: 'hub-2' }],
        nearestDetermined: true,
      }),
    ).toMatch(/stale after hub selection/i);
    expect(
      shipmentSendGuard({
        deliveryType: 'hub',
        selectedHubId: '',
        fingerprintHubId: '',
        hubs: [{ id: 'hub-1' }, { id: 'hub-2' }],
        nearestDetermined: false,
      }),
    ).toMatch(/select a delivery hub/i);
  });

  it('treats a hub change as an unusable stale fingerprint', () => {
    const fp = createQuoteFingerprint({
      providerCode: 'SILA_SY',
      serviceId: 'SILA_SY:cour:area',
      currency: 'USD',
      amount: 4,
      deliveryType: 'hub',
      packageType: 'box',
      weightKg: 1,
      destinationKey: 'addr:damascus|damascus|',
      hubId: 'hub-old',
    });
    expect(
      isQuoteFingerprintFresh(fp, {
        providerCode: 'SILA_SY',
        serviceId: 'SILA_SY:cour:area',
        currency: 'USD',
        amount: 4,
        deliveryType: 'hub',
        packageType: 'box',
        weightKg: 1,
        destinationKey: 'addr:damascus|damascus|',
        hubId: 'hub-new',
      }),
    ).toBe(false);
    expect(
      isQuoteFingerprintFresh(fp, {
        providerCode: 'SILA_SY',
        serviceId: 'SILA_SY:cour:area',
        currency: 'USD',
        amount: 4,
        deliveryType: 'hub',
        packageType: 'box',
        weightKg: 1,
        destinationKey: 'addr:damascus|damascus|',
        hubId: 'hub-old',
      }),
    ).toBe(true);
  });
});
