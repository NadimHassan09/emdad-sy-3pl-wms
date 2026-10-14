import { summarizeBatchMembers } from './oms-batch-summary';

describe('summarizeBatchMembers', () => {
  it('keeps mixed order statuses inside one batch summary', () => {
    const summary = summarizeBatchMembers([
      { status: 'processing', outboundStatus: 'packing' },
      { status: 'processing', outboundStatus: 'packing' },
      { status: 'failed_delivery', outboundStatus: null, issueNote: null },
      { status: 'delivered', outboundStatus: 'shipped', issueNote: 'Damaged' },
    ]);
    expect(summary.orderCount).toBe(4);
    expect(summary.completedCount).toBe(1);
    expect(summary.issueCount).toBe(2);
    expect(summary.stageKind).toBe('operational');
    expect(summary.stageKey).toBe('packing');
  });

  it('does not invent a single stage when the group is split evenly', () => {
    const summary = summarizeBatchMembers([
      { status: 'processing', outboundStatus: 'picking' },
      { status: 'out_for_delivery', outboundStatus: 'shipped' },
    ]);
    expect(summary.stageKind).toBe('mixed');
    expect(summary.stageKey).toBeNull();
  });
});
