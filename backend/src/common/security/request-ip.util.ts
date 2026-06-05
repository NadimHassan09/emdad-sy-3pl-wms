import type { Request } from 'express';

/** Best-effort client IP behind reverse proxies (first X-Forwarded-For hop). */
export function getClientIp(req: Request | undefined): string {
  if (!req) return 'unknown';
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}
