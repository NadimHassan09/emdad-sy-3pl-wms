import {
  applyConfirmedCarrierAwbToMeta,
  mergeShipmentRawMeta,
  readSilaCancelMeta,
} from './sila-meta.util';

describe('sila-meta.util', () => {
  it('keeps silaCancel when a tracking snapshot is merged', () => {
    const merged = mergeShipmentRawMeta(
      {
        silaCancel: {
          state: 'pending_confirmation',
          courierCancel: 'pending_confirmation',
          at: '2026-10-21T10:00:00.000Z',
        },
        codCollection: { amount: 10 },
      },
      { id: 'cargo-1', status: 'cancelled', courier_barcode: 'AWB-1' },
    );
    expect(readSilaCancelMeta(merged)?.state).toBe('pending_confirmation');
    expect(merged.codCollection).toEqual({ amount: 10 });
    expect(merged.courier_barcode).toBe('AWB-1');
  });

  it('clears silaCancel only when the patch sets it to null', () => {
    const merged = mergeShipmentRawMeta(
      { silaCancel: { state: 'cancelled', at: '2026-10-21T10:00:00.000Z' } },
      { silaCancel: null, status: 'cancelled' },
    );
    expect(merged.silaCancel).toBeUndefined();
  });

  it('overwrites a stale remote_label_code when the confirmed carrier AWB changes', () => {
    const merged = applyConfirmedCarrierAwbToMeta(
      {
        courier_barcode: 'TARABUT-OLD-AWB',
        shipments: [{ remote_label_code: 'TARABUT-OLD-AWB', remote_barcode: 'TARABUT-OLD-AWB' }],
      },
      'KARAM-NEW-AWB',
    );
    expect(merged.courier_barcode).toBe('KARAM-NEW-AWB');
    expect((merged.shipments as Array<Record<string, unknown>>)[0].remote_label_code).toBe(
      'KARAM-NEW-AWB',
    );
  });
});
