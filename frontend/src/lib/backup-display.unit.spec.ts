import { describe, expect, it } from 'vitest';

import {
  formatCooldownClock,
  isBackupDownloadable,
  isBackupJobId,
  manualBackupErrorMessage,
  resolveCreatedBackupJobId,
} from './backup-display';

describe('isBackupDownloadable', () => {
  it('hides Download while a manual backup is still processing', () => {
    expect(
      isBackupDownloadable({
        type: 'manual',
        status: 'pending',
        bytesWritten: 0,
        downloadable: false,
      }),
    ).toBe(false);
    expect(
      isBackupDownloadable({
        type: 'manual',
        status: 'running',
        bytesWritten: 100,
        downloadable: false,
      }),
    ).toBe(false);
  });

  it('shows Download only when the backend marks the completed file as downloadable', () => {
    expect(
      isBackupDownloadable({
        type: 'manual',
        status: 'completed',
        bytesWritten: 2048,
        downloadable: true,
      }),
    ).toBe(true);
  });

  it('hides Download for failed backups even if a stale downloadable flag is present', () => {
    expect(
      isBackupDownloadable({
        type: 'manual',
        status: 'failed',
        bytesWritten: 0,
        downloadable: false,
      }),
    ).toBe(false);
  });
});

describe('resolveCreatedBackupJobId', () => {
  it('does not treat missing ids as pollable job ids', () => {
    expect(isBackupJobId(undefined)).toBe(false);
    expect(isBackupJobId('undefined')).toBe(false);
    expect(isBackupJobId('none')).toBe(false);
    expect(resolveCreatedBackupJobId({ status: 'pending' })).toBeNull();
  });

  it('reads jobId from a wrapped or unwrapped create response', () => {
    const id = '88875021-b42c-4dba-adcf-f39f5457b776';
    expect(resolveCreatedBackupJobId({ jobId: id, status: 'pending' })).toBe(id);
    expect(resolveCreatedBackupJobId({ data: { id, type: 'manual' } })).toBe(id);
    expect(
      resolveCreatedBackupJobId({
        jobId: id,
        data: { unrelated: true },
      }),
    ).toBe(id);
    expect(resolveCreatedBackupJobId(JSON.stringify({ jobId: id }))).toBe(id);
  });
});

describe('manual backup cooldown copy', () => {
  it('defaults remaining-time copy from the 15-minute cooldown', () => {
    expect(formatCooldownClock(900, false)).toBe('15m');
    expect(
      manualBackupErrorMessage(
        { code: 'BACKUP_MANUAL_COOLDOWN', fields: { remainingSeconds: '120' } },
        false,
      ),
    ).toContain('2m');
  });
});
