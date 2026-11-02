import { describe, expect, it } from 'vitest';
import { getReturnStatusDisplay, getReturnStatusOptions } from './oms-return-status';

describe('oms-return-status', () => {
  it('returns Arabic labels as requested by user', () => {
    expect(getReturnStatusDisplay('requested', true)).toBe('مرتجع بانتظار الاستلام');
    expect(getReturnStatusDisplay('completed', true)).toBe('مرتجع مستلم');
    expect(getReturnStatusDisplay('cancelled', true)).toBe('ملغي');
    expect(getReturnStatusDisplay('approved', true)).toBe('معتمد (بانتظار الاستلام)');
    expect(getReturnStatusDisplay('rejected', true)).toBe('مرفوض');
  });

  it('returns English labels when not Arabic', () => {
    expect(getReturnStatusDisplay('requested', false)).toBe('Return Pending Receipt');
    expect(getReturnStatusDisplay('completed', false)).toBe('Return Received');
    expect(getReturnStatusDisplay('cancelled', false)).toBe('Cancelled');
    expect(getReturnStatusDisplay('approved', false)).toBe('Approved');
    expect(getReturnStatusDisplay('rejected', false)).toBe('Rejected');
  });

  it('handles unknown or empty statuses gracefully', () => {
    expect(getReturnStatusDisplay(null, false)).toBe('—');
    expect(getReturnStatusDisplay('custom_status', false)).toBe('custom status');
  });

  it('provides correct options for filters', () => {
    const arOptions = getReturnStatusOptions(true);
    expect(arOptions).toContainEqual({ value: 'requested', label: 'مرتجع بانتظار الاستلام' });
    expect(arOptions).toContainEqual({ value: 'completed', label: 'مرتجع مستلم' });

    const enOptions = getReturnStatusOptions(false);
    expect(enOptions).toContainEqual({ value: 'requested', label: 'Return Pending Receipt' });
    expect(enOptions).toContainEqual({ value: 'completed', label: 'Return Received' });
  });
});
