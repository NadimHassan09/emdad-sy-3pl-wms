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

