/**
 * COD return status must follow OMS return lifecycle — not financial net alone.
 * Mirrors CodRecordsService.syncReturnedStatusIfNeeded decision.
 */
function shouldMarkCodReturned(params: {
  force: boolean;
  omsStatus: string;
  netAmount: number;
}): boolean {
  return params.force || params.omsStatus === 'returned';
}

describe('COD returned lifecycle (no net<=0 alone)', () => {
  it('net <= 0 + return requested (OMS delivered) → do NOT mark COD returned', () => {
    expect(
      shouldMarkCodReturned({ force: false, omsStatus: 'delivered', netAmount: 0 }),
    ).toBe(false);
  });

  it('net <= 0 + return completed (OMS returned, force) → mark COD returned', () => {
    expect(
      shouldMarkCodReturned({ force: true, omsStatus: 'returned', netAmount: 0 }),
    ).toBe(true);
  });

  it('net > 0 + OMS returned → mark COD returned', () => {
    expect(
      shouldMarkCodReturned({ force: false, omsStatus: 'returned', netAmount: 40 }),
    ).toBe(true);
  });

  it('delivered without return → do not mark COD returned', () => {
    expect(
      shouldMarkCodReturned({ force: false, omsStatus: 'delivered', netAmount: 60 }),
    ).toBe(false);
  });
});
