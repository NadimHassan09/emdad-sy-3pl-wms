"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnv = validateEnv;
const zod_1 = require("zod");
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    PORT: zod_1.z.coerce.number().int().positive().max(65535).default(3000),
    CORS_ORIGINS: zod_1.z.string().min(1).default('http://localhost:5173'),
    JWT_SECRET: zod_1.z.string().min(16),
    JWT_REFRESH_SECRET: zod_1.z.string().min(16).optional(),
    HTTP_JSON_BODY_LIMIT: zod_1.z.string().optional(),
    HTTP_FORM_BODY_LIMIT: zod_1.z.string().optional(),
    AUTH_COOKIE_DOMAIN: zod_1.z.string().optional(),
    READY_RETRY_PENDING_MAX: zod_1.z.coerce.number().int().nonnegative().default(1000),
    OPS_LIVENESS_ENABLED: zod_1.z.enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off']).optional(),
    OPS_READINESS_ENABLED: zod_1.z.enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off']).optional(),
    OPS_READY_VERBOSE: zod_1.z.enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off']).optional(),
    OPS_DIAGNOSTICS_ENABLED: zod_1.z.enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off']).optional(),
    OPS_PROBE_SECRET: zod_1.z.string().min(16).optional(),
    AUDIT_RETENTION_DAYS: zod_1.z.coerce.number().int().min(0).max(3650).optional(),
    AUDIT_QUERY_MAX_LIMIT: zod_1.z.coerce.number().int().min(1).max(100).optional(),
    AUDIT_QUERY_MAX_OFFSET: zod_1.z.coerce.number().int().min(0).max(50_000).optional(),
    AUDIT_QUERY_MAX_DATE_RANGE_DAYS: zod_1.z.coerce.number().int().min(1).max(366).optional(),
    AUDIT_QUERY_DEFAULT_WINDOW_DAYS: zod_1.z.coerce.number().int().min(1).max(366).optional(),
    AUDIT_QUERY_COUNT_CAP: zod_1.z.coerce.number().int().min(100).max(1_000_000).optional(),
    AUDIT_EXPORT_MAX_ROWS: zod_1.z.coerce.number().int().min(1).max(5000).optional(),
    AUDIT_EXPORT_MAX_DATE_RANGE_DAYS: zod_1.z.coerce.number().int().min(1).max(366).optional(),
    AUDIT_EXPORT_ENABLED: zod_1.z.enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off']).optional(),
    BACKUP_ENABLED: zod_1.z.enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off']).optional(),
    BACKUP_STORAGE_PATH: zod_1.z.string().min(1).optional(),
    BACKUP_ENV_ID: zod_1.z.string().min(1).optional(),
    BACKUP_SIGNING_SECRET: zod_1.z.string().min(16).optional(),
    BACKUP_DOWNLOAD_TOKEN_TTL_SEC: zod_1.z.coerce.number().int().min(60).max(3600).optional(),
    BACKUP_MANUAL_COOLDOWN_SEC: zod_1.z.coerce.number().int().min(0).max(86400).optional(),
    BACKUP_PG_DUMP_PATH: zod_1.z.string().min(1).optional(),
    BACKUP_PG_RESTORE_PATH: zod_1.z.string().min(1).optional(),
    BACKUP_MAX_UPLOAD_BYTES: zod_1.z.coerce.number().int().positive().optional(),
    BACKUP_PRE_SNAPSHOT_REQUIRED: zod_1.z.enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off']).optional(),
    FACTORY_RESET_ENABLED: zod_1.z.enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off']).optional(),
    BACKUP_SCHEDULER_ENABLED: zod_1.z.enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off']).optional(),
    BACKUP_RETENTION_CLEANUP_ENABLED: zod_1.z.enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off']).optional(),
    BACKUP_KEEP_LAST_DAILY: zod_1.z.coerce.number().int().min(1).max(365).optional(),
    BACKUP_KEEP_LAST_WEEKLY: zod_1.z.coerce.number().int().min(1).max(120).optional(),
    BACKUP_KEEP_LAST_MONTHLY: zod_1.z.coerce.number().int().min(1).max(120).optional(),
    BACKUP_PRE_SNAPSHOT_PROTECT_DAYS: zod_1.z.coerce.number().int().min(1).max(90).optional(),
    BACKUP_HEALTH_MONITORING_ENABLED: zod_1.z.enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off']).optional(),
    BACKUP_HEALTH_MAX_SUCCESS_AGE_HOURS: zod_1.z.coerce.number().int().min(1).max(720).optional(),
    BACKUP_HEALTH_WARN_SUCCESS_AGE_HOURS: zod_1.z.coerce.number().int().min(1).max(720).optional(),
    BACKUP_HEALTH_STORAGE_WARN_BYTES: zod_1.z.coerce.number().int().min(1).optional(),
    BACKUP_HEALTH_STORAGE_CRITICAL_BYTES: zod_1.z.coerce.number().int().min(1).optional(),
    BACKUP_HEALTH_FAILURE_WINDOW_HOURS: zod_1.z.coerce.number().int().min(1).max(168).optional(),
    BACKUP_HEALTH_FAILURE_WARN_COUNT: zod_1.z.coerce.number().int().min(1).max(50).optional(),
    BACKUP_HEALTH_FAILURE_CRITICAL_COUNT: zod_1.z.coerce.number().int().min(1).max(50).optional(),
    BACKUP_HEALTH_ALERT_COOLDOWN_HOURS: zod_1.z.coerce.number().int().min(1).max(168).optional(),
    BACKUP_GDRIVE_ENABLED: zod_1.z.enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off']).optional(),
    BACKUP_GDRIVE_CLIENT_ID: zod_1.z.string().min(1).optional(),
    BACKUP_GDRIVE_CLIENT_SECRET: zod_1.z.string().min(1).optional(),
    BACKUP_GDRIVE_REDIRECT_URI: zod_1.z.string().url().optional(),
    BACKUP_GDRIVE_ROOT_FOLDER_NAME: zod_1.z.string().min(1).optional(),
    BACKUP_GDRIVE_CONNECT_SUCCESS_URL: zod_1.z.string().url().optional(),
    BACKUP_ENCRYPTION_KEY: zod_1.z.string().min(16).optional(),
    BACKUP_GDRIVE_STARTUP_STRICT: zod_1.z.enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off']).optional(),
});
function envBool(raw) {
    if (raw === undefined || raw === null || raw === '')
        return false;
    const v = String(raw).trim().toLowerCase();
    return ['true', '1', 'yes', 'on'].includes(v);
}
function validateEnv(raw) {
    const parsed = envSchema.parse(raw);
    if (envBool(parsed.BACKUP_GDRIVE_ENABLED)) {
        const missing = [];
        if (!parsed.BACKUP_GDRIVE_CLIENT_ID)
            missing.push('BACKUP_GDRIVE_CLIENT_ID');
        if (!parsed.BACKUP_GDRIVE_CLIENT_SECRET)
            missing.push('BACKUP_GDRIVE_CLIENT_SECRET');
        if (!parsed.BACKUP_GDRIVE_REDIRECT_URI)
            missing.push('BACKUP_GDRIVE_REDIRECT_URI');
        if (!parsed.BACKUP_ENCRYPTION_KEY)
            missing.push('BACKUP_ENCRYPTION_KEY');
        if (missing.length > 0) {
            const strict = parsed.BACKUP_GDRIVE_STARTUP_STRICT !== undefined
                ? envBool(parsed.BACKUP_GDRIVE_STARTUP_STRICT)
                : parsed.NODE_ENV === 'production';
            if (strict) {
                throw new Error(`BACKUP_GDRIVE_ENABLED=true requires: ${missing.join(', ')}. ` +
                    'Obtain OAuth credentials from Google Cloud Console or set BACKUP_GDRIVE_ENABLED=false.');
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
//# sourceMappingURL=env.validation.js.map