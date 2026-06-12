/**
 * Frontend-only flag to show or hide Google Drive backup UI.
 * Backend APIs and schema remain unchanged; when false, no Drive surfaces render.
 */
declare const __BACKUP_GDRIVE_UI_ENABLED__: string | undefined;

function parseFlag(value: string | undefined): boolean {
  if (value == null || value === '') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

export function isBackupGdriveUiEnabled(): boolean {
  return parseFlag(__BACKUP_GDRIVE_UI_ENABLED__);
}
