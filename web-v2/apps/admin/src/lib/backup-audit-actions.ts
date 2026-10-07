/** Audit actions shown in backup administration panels. */
export const BACKUP_AUDIT_ACTION_PREFIXES = [
  'backup.',
  'system.factory_reset',
] as const;

export function isBackupAuditAction(action: string): boolean {
  return BACKUP_AUDIT_ACTION_PREFIXES.some((prefix) => action.startsWith(prefix));
}

const BACKUP_HEALTH_AUDIT_ACTIONS = new Set(['backup.health.warning', 'backup.health.critical']);

export function isBackupHealthAuditAction(action: string): boolean {
  return BACKUP_HEALTH_AUDIT_ACTIONS.has(action);
}

const DRIVE_RETENTION_AUDIT_ACTIONS = new Set([
  'backup.drive.retention.cleanup',
  'backup.drive.deleted',
]);

export function isDriveRetentionAuditAction(action: string): boolean {
  return DRIVE_RETENTION_AUDIT_ACTIONS.has(action);
}
