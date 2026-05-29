import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  CORS_ORIGINS: z.string().min(1).default('http://localhost:5173'),
  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16).optional(),
  HTTP_JSON_BODY_LIMIT: z.string().optional(),
  HTTP_FORM_BODY_LIMIT: z.string().optional(),
  AUTH_COOKIE_DOMAIN: z.string().optional(),
  READY_RETRY_PENDING_MAX: z.coerce.number().int().nonnegative().default(1000),
  AUDIT_RETENTION_DAYS: z.coerce.number().int().min(0).max(3650).optional(),
  AUDIT_QUERY_MAX_LIMIT: z.coerce.number().int().min(1).max(100).optional(),
  AUDIT_QUERY_MAX_OFFSET: z.coerce.number().int().min(0).max(50_000).optional(),
  AUDIT_QUERY_MAX_DATE_RANGE_DAYS: z.coerce.number().int().min(1).max(366).optional(),
  AUDIT_QUERY_DEFAULT_WINDOW_DAYS: z.coerce.number().int().min(1).max(366).optional(),
  AUDIT_QUERY_COUNT_CAP: z.coerce.number().int().min(100).max(1_000_000).optional(),
  AUDIT_EXPORT_MAX_ROWS: z.coerce.number().int().min(1).max(5000).optional(),
  AUDIT_EXPORT_MAX_DATE_RANGE_DAYS: z.coerce.number().int().min(1).max(366).optional(),
  AUDIT_EXPORT_ENABLED: z.enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off']).optional(),
});

export function validateEnv(raw: Record<string, unknown>): Record<string, unknown> {
  const parsed = envSchema.parse(raw);

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

