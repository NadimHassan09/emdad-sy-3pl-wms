/**
 * Secret-safe webhook latency logs. Never include signing keys, passwords,
 * verify hashes, raw bodies, or recipient fields.
 */

const SECRET_PATTERN =
  /secret|password|passwd|token|api[_-]?key|webhook[_-]?key|authorization|whsec_|verify/i;

export type ShippingWebhookTimingInput = {
  providerCode: string;
  handshake: boolean;
  receivedAt: Date;
  verifiedMs: number;
  processedMs: number;
  totalMs: number;
  providerEventTime?: string | null;
  awb?: string | null;
  eventType?: string | null;
  externalEventId?: string | null;
  action?: string | null;
  orderId?: string | null;
};

export function providerEventTimeIso(
  body: unknown,
  event?: { timestamp?: Date | string | null },
): string | null {
  if (event?.timestamp instanceof Date && !Number.isNaN(event.timestamp.getTime())) {
    return event.timestamp.toISOString();
  }
  if (typeof event?.timestamp === 'string' && event.timestamp.trim()) {
    const parsed = new Date(event.timestamp);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  if (typeof record.time === 'number' && Number.isFinite(record.time) && record.time > 1_000_000_000) {
    const fromUnix = new Date(record.time * 1000);
    if (!Number.isNaN(fromUnix.getTime())) return fromUnix.toISOString();
  }
  for (const key of ['occurred_at', 'occurredAt', 'updated_at', 'created_at', 'timestamp']) {
    const value = record[key];
    if (typeof value !== 'string' || !value.trim()) continue;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

export function deliveryLagMs(receivedAt: Date, providerEventTime: string | null): number | null {
  if (!providerEventTime) return null;
  const providerAt = new Date(providerEventTime).getTime();
  if (Number.isNaN(providerAt)) return null;
  return receivedAt.getTime() - providerAt;
}

export function buildShippingWebhookTimingLog(
  input: ShippingWebhookTimingInput,
): Record<string, unknown> {
  const providerEventTime = input.providerEventTime || null;
  const log: Record<string, unknown> = {
    msg: 'shipping_webhook_timing',
    providerCode: input.providerCode,
    handshake: input.handshake,
    receivedAt: input.receivedAt.toISOString(),
    verifiedMs: input.verifiedMs,
    processedMs: input.processedMs,
    totalMs: input.totalMs,
    providerEventTime,
    deliveryLagMs: deliveryLagMs(input.receivedAt, providerEventTime),
    awb: input.awb || null,
    eventType: input.eventType || null,
    externalEventId: input.externalEventId || null,
    action: input.action || null,
    orderId: input.orderId || null,
  };
  return redactSecretFields(log);
}

export function redactSecretFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => redactSecretFields(item)) as T;
  }
  if (!value || typeof value !== 'object') return value;
  const next: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_PATTERN.test(key)) {
      next[key] = '[redacted]';
      continue;
    }
    next[key] = redactSecretFields(nested);
  }
  return next as T;
}

export function timingLogContainsSecrets(log: Record<string, unknown>): boolean {
  const json = JSON.stringify(log);
  return (
    /whsec_|webhook_key|api[_-]?key|password|authorization/i.test(json) ||
    Object.keys(log).some((key) => SECRET_PATTERN.test(key) && log[key] !== '[redacted]')
  );
}
