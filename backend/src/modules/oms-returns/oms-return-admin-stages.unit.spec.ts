import { OmsReturnStatus } from '@prisma/client';

import {
  assertOmsReturnAdminStageAction,
  nextOmsReturnAdminAction,
} from './oms-return-admin-stages';

describe('oms-return-admin-stages', () => {
  it('next action: requested → approve', () => {
    expect(nextOmsReturnAdminAction(OmsReturnStatus.requested)).toBe('approve');
  });

  it('next action: approved with unreceived → complete_receiving', () => {
    expect(
      nextOmsReturnAdminAction(OmsReturnStatus.approved, {
        status: 'receiving',
        hasUnreceivedQty: true,
        hasUnpostedQty: false,
      }),
    ).toBe('complete_receiving');
  });

  it('next action: approved after receive → complete_putaway', () => {
    expect(
      nextOmsReturnAdminAction(OmsReturnStatus.approved, {
        status: 'receiving',
        hasUnreceivedQty: false,
        hasUnpostedQty: true,
      }),
    ).toBe('complete_putaway');
  });

  it('next action: completed → null', () => {
    expect(nextOmsReturnAdminAction(OmsReturnStatus.completed)).toBeNull();
  });

  it('assert: approve only on requested', () => {
    expect(() =>
      assertOmsReturnAdminStageAction(OmsReturnStatus.approved, 'approve'),
    ).toThrow(/requested/);
  });

  it('assert: receiving/putaway require approved', () => {
    expect(() =>
      assertOmsReturnAdminStageAction(
        OmsReturnStatus.requested,
        'complete_receiving',
      ),
    ).toThrow(/approved/);
  });
});
