import { readFileSync } from 'fs';
import { join } from 'path';

describe('scheduled backups vs manual cooldown', () => {
  it('does not apply the manual cooldown gate to scheduled backup starts', () => {
    const src = readFileSync(join(__dirname, 'backup-scheduler.service.ts'), 'utf8');
    expect(src).not.toContain('BackupManualGateService');
    expect(src).not.toContain('assertCanStartManual');
    expect(src).not.toContain('createPendingManualJob');
    expect(src).toContain('BackupJobType.scheduled');
  });
});
