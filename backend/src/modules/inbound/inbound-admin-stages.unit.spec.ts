import { InboundOrderStatus } from '@prisma/client';

import { InvalidStateException } from '../../common/errors/domain-exceptions';
import {
  assertInboundAdminStageAction,
  isInboundAdminConfirmable,
  nextInboundAdminAction,
} from './inbound-admin-stages';

describe('inbound-admin-stages', () => {
  it('returns approve for confirmable statuses', () => {
    expect(nextInboundAdminAction(InboundOrderStatus.draft)).toBe('approve');
    expect(nextInboundAdminAction(InboundOrderStatus.pending_approval)).toBe('approve');
    expect(isInboundAdminConfirmable(InboundOrderStatus.draft)).toBe(true);
  });

  it('returns receiving then putaway based on open task hint', () => {
    expect(nextInboundAdminAction(InboundOrderStatus.in_progress, 'receiving')).toBe(
      'complete_receiving',
    );
    expect(nextInboundAdminAction(InboundOrderStatus.in_progress, 'putaway')).toBe(
      'complete_putaway',
    );
    expect(nextInboundAdminAction(InboundOrderStatus.partially_received, 'putaway')).toBe(
      'complete_putaway',
    );
  });

  it('returns null when completed', () => {
    expect(nextInboundAdminAction(InboundOrderStatus.completed)).toBeNull();
    expect(nextInboundAdminAction(InboundOrderStatus.cancelled)).toBeNull();
  });

  it('allows staged path and rejects approve after start', () => {
    expect(() =>
      assertInboundAdminStageAction(InboundOrderStatus.draft, 'approve'),
    ).not.toThrow();
    expect(() =>
      assertInboundAdminStageAction(InboundOrderStatus.in_progress, 'complete_receiving'),
    ).not.toThrow();
    expect(() =>
      assertInboundAdminStageAction(InboundOrderStatus.in_progress, 'complete_putaway'),
    ).not.toThrow();
    expect(() =>
      assertInboundAdminStageAction(InboundOrderStatus.in_progress, 'approve'),
    ).toThrow(InvalidStateException);
    expect(() =>
      assertInboundAdminStageAction(InboundOrderStatus.draft, 'complete_receiving'),
    ).toThrow(InvalidStateException);
  });
});
