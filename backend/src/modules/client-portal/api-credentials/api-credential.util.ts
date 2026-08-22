import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const API_KEY_PREFIX = 'emd_live_';
export const SECRET_ONCE_WARNING =
  'Save this secret now. It will not be shown again.';

export function hashApiSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

export function verifyApiSecret(plain: string, storedHash: string): boolean {
  if (!plain || !storedHash) return false;
  const candidate = hashApiSecret(plain);
  const a = Buffer.from(candidate, 'utf8');
  const b = Buffer.from(storedHash, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function generateApiKey(): string {
  return `${API_KEY_PREFIX}${randomBytes(16).toString('hex')}`;
}

export function generateApiSecret(): string {
  return randomBytes(32).toString('base64url');
}

export function apiKeyPrefix(apiKey: string): string {
  if (apiKey.length <= 12) return `${apiKey.slice(0, 4)}…`;
  return `${apiKey.slice(0, 12)}…`;
}

export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 10) return '••••••••';
  return `${apiKey.slice(0, 8)}…${apiKey.slice(-4)}`;
}

export type ParsedApiCredentials = { apiKey: string; apiSecret: string };

export function parseApiCredentials(input: {
  apiKeyHeader?: string | string[];
  apiSecretHeader?: string | string[];
  authorization?: string | string[];
}): ParsedApiCredentials | null {
  const keyHeader = firstHeader(input.apiKeyHeader)?.trim();
  const secretHeader = firstHeader(input.apiSecretHeader)?.trim();
  if (keyHeader && secretHeader) {
    return { apiKey: keyHeader, apiSecret: secretHeader };
  }

  const auth = firstHeader(input.authorization)?.trim();
  if (!auth) return null;
  const bearer = auth.match(/^Bearer\s+(.+)$/i);
  if (!bearer) return null;
  const token = bearer[1].trim();
  const split = token.split(':');
  if (split.length >= 2 && split[0].startsWith(API_KEY_PREFIX)) {
    return { apiKey: split[0], apiSecret: split.slice(1).join(':') };
  }
  return null;
}

function firstHeader(value?: string | string[]): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
