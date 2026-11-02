import { describe, expect, it } from 'vitest';

import { remainingFromNextAllowedAt } from './useManualBackupCooldown';

describe('remainingFromNextAllowedAt', () => {
  it('uses authoritative nextAllowedAt for the remaining cooldown', () => {
    const now = Date.parse('2026-10-23T10:00:00.000Z');
    const next = '2026-10-23T10:02:30.000Z';
    expect(remainingFromNextAllowedAt(next, 999, now)).toBe(150);
  });

  it('returns zero after expiry so a new manual backup can start', () => {
    const now = Date.parse('2026-10-23T10:20:00.000Z');
    const next = '2026-10-23T10:15:00.000Z';
    expect(remainingFromNextAllowedAt(next, 12, now)).toBe(0);
  });
});
