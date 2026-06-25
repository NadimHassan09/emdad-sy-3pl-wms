import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  CORS_ORIGINS: z.string().min(1).default('http://localhost:5173'),
  // Comma-separated list of trusted external landing-page origins allowed to POST /api/forms/submit.
  LANDING_FORM_CORS_ORIGINS: z.string().optional(),
  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16).optional(),
  HTTP_JSON_BODY_LIMIT: z.string().optional(),
  HTTP_FORM_BODY_LIMIT: z.string().optional(),
  AUTH_COOKIE_DOMAIN: z.string().optional(),
  READY_RETRY_PENDING_MAX: z.coerce.number().int().nonnegative().default(1000),
  OPS_LIVENESS_ENABLED: z.enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off']).optional(),
  OPS_READINESS_ENABLED: z.enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off']).optional(),
  OPS_READY_VERBOSE: z.enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off']).optional(),
  OPS_DIAGNOSTICS_ENABLED: z.enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off']).optional(),
  OPS_PROBE_SECRET: z.string().min(16).optional(),
  AUDIT_RETENTION_DAYS: z.coerce.number().int().min(0).max(3650).optional(),
  AUDIT_QUERY_MAX_LIMIT: z.coerce.number().int().min(1).max(100).optional(),
  AUDIT_QUERY_MAX_OFFSET: z.coerce.number().int().min(0).max(50_000).optional(),
  AUDIT_QUERY_MAX_DATE_RANGE_DAYS: z.coerce.number().int().min(1).max(366).optional(),
  AUDIT_QUERY_DEFAULT_WINDOW_DAYS: z.coerce.number().int().min(1).max(366).optional(),
  AUDIT_QUERY_COUNT_CAP: z.coerce.number().int().min(100).max(1_000_000).optional(),
  AUDIT_EXPORT_MAX_ROWS: z.coerce.number().int().min(1).max(5000).optional(),
  AUDIT_EXPORT_MAX_DATE_RANGE_DAYS: z.coerce.number().int().min(1).max(366).optional(),
  AUDIT_EXPORT_ENABLED: z.enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off']).optional(),
  BACKUP_ENABLED: z.enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off']).optional(),
  BACKUP_STORAGE_PATH: z.string().min(1).optional(),
  BACKUP_ENV_ID: z.string().min(1).optional(),
  BACKUP_SIGNING_SECRET: z.string().min(16).optional(),
  BACKUP_DOWNLOAD_TOKEN_TTL_SEC: z.coerce.number().int().min(60).max(3600).optional(),
  BACKUP_MANUAL_COOLDOWN_SEC: z.coerce.number().int().min(0).max(86400).optional(),
  BACKUP_PG_DUMP_PATH: z.string().min(1).optional(),
  BACKUP_PG_RESTORE_PATH: z.string().min(1).optional(),
  BACKUP_MAX_UPLOAD_BYTES: z.coerce.number().int().positive().optional(),
  BACKUP_PRE_SNAPSHOT_REQUIRED: z.enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off']).optional(),
  FACTORY_RESET_ENABLED: z.enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off']).optional(),
  BACKUP_SCHEDULER_ENABLED: z.enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off']).optional(),
  BACKUP_RETENTION_CLEANUP_ENABLED: z.enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off']).optional(),
  BACKUP_KEEP_LAST_DAILY: z.coerce.number().int().min(1).max(365).optional(),
  BACKUP_KEEP_LAST_WEEKLY: z.coerce.number().int().min(1).max(120).optional(),
  BACKUP_KEEP_LAST_MONTHLY: z.coerce.number().int().min(1).max(120).optional(),
  BACKUP_PRE_SNAPSHOT_PROTECT_DAYS: z.coerce.number().int().min(1).max(90).optional(),
  BACKUP_HEALTH_MONITORING_ENABLED: z.enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off']).optional(),
  BACKUP_HEALTH_MAX_SUCCESS_AGE_HOURS: z.coerce.number().int().min(1).max(720).optional(),
  BACKUP_HEALTH_WARN_SUCCESS_AGE_HOURS: z.coerce.number().int().min(1).max(720).optional(),
  BACKUP_HEALTH_STORAGE_WARN_BYTES: z.coerce.number().int().min(1).optional(),
  BACKUP_HEALTH_STORAGE_CRITICAL_BYTES: z.coerce.number().int().min(1).optional(),
  BACKUP_HEALTH_FAILURE_WINDOW_HOURS: z.coerce.number().int().min(1).max(168).optional(),
  BACKUP_HEALTH_FAILURE_WARN_COUNT: z.coerce.number().int().min(1).max(50).optional(),
  BACKUP_HEALTH_FAILURE_CRITICAL_COUNT: z.coerce.number().int().min(1).max(50).optional(),
  BACKUP_HEALTH_ALERT_COOLDOWN_HOURS: z.coerce.number().int().min(1).max(168).optional(),
  BACKUP_GDRIVE_ENABLED: z.enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off']).optional(),
  BACKUP_GDRIVE_CLIENT_ID: z.string().min(1).optional(),
  BACKUP_GDRIVE_CLIENT_SECRET: z.string().min(1).optional(),
  BACKUP_GDRIVE_REDIRECT_URI: z.string().url().optional(),
  BACKUP_GDRIVE_ROOT_FOLDER_NAME: z.string().min(1).optional(),
  BACKUP_GDRIVE_CONNECT_SUCCESS_URL: z.string().url().optional(),
  BACKUP_ENCRYPTION_KEY: z.string().min(16).optional(),
  BACKUP_GDRIVE_STARTUP_STRICT: z.enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off']).optional(),
  CRON_LEADER_ENABLED: z.enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off']).optional(),
});

function envBool(raw: unknown): boolean {
  if (raw === undefined || raw === null || raw === '') return false;
  const v = String(raw).trim().toLowerCase();
  return ['true', '1', 'yes', 'on'].includes(v);
}

export function validateEnv(raw: Record<string, unknown>): Record<string, unknown> {
  const parsed = envSchema.parse(raw);

  if (envBool(parsed.BACKUP_GDRIVE_ENABLED)) {
    const missing: string[] = [];
    if (!parsed.BACKUP_GDRIVE_CLIENT_ID) missing.push('BACKUP_GDRIVE_CLIENT_ID');
    if (!parsed.BACKUP_GDRIVE_CLIENT_SECRET) missing.push('BACKUP_GDRIVE_CLIENT_SECRET');
    if (!parsed.BACKUP_GDRIVE_REDIRECT_URI) missing.push('BACKUP_GDRIVE_REDIRECT_URI');
    if (!parsed.BACKUP_ENCRYPTION_KEY) missing.push('BACKUP_ENCRYPTION_KEY');
    if (missing.length > 0) {
      const strict =
        parsed.BACKUP_GDRIVE_STARTUP_STRICT !== undefined
          ? envBool(parsed.BACKUP_GDRIVE_STARTUP_STRICT)
          : parsed.NODE_ENV === 'production';
      if (strict) {
        throw new Error(
          `BACKUP_GDRIVE_ENABLED=true requires: ${missing.join(', ')}. ` +
            'Obtain OAuth credentials from Google Cloud Console or set BACKUP_GDRIVE_ENABLED=false.',
        );
      }
    }
  }

  if (parsed.NODE_ENV === 'production') {
    if (parsed.JWT_SECRET === 'dev-only-change-in-production') {
      throw new Error('JWT_SECRET must be overridden in production.');
    }
    if (!parsed.JWT_REFRESH_SECRET) {
      throw new Error('JWT_REFRESH_SECRET is required in production.');
    }
    if (parsed.JWT_REFRESH_SECRET === parsed.JWT_SECRET) {
      throw new Error('JWT_REFRESH_SECRET must be different from JWT_SECRET in production.');
    }
  }

  return parsed;
}

