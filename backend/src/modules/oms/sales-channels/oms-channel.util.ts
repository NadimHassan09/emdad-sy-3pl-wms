import { createHash, timingSafeEqual } from 'node:crypto';

import { OmsSalesChannelType } from '@prisma/client';

export type OmsChannelHandlerResult = {
  accepted: boolean;
  externalId?: string;
  message?: string;
};

export type OmsChannelInboundContext = {
  companyId: string;
  channelType: OmsSalesChannelType;
  channelId: string;
  payload: Record<string, unknown>;
};

export type OmsChannelHandler = (
  ctx: OmsChannelInboundContext,
) => Promise<OmsChannelHandlerResult>;

export function hashWebhookSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

export function verifyWebhookSecret(plain: string, storedHash: string): boolean {
  const candidate = hashWebhookSecret(plain);
  const a = Buffer.from(candidate, 'utf8');
  const b = Buffer.from(storedHash, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function generateWebhookSecret(): string {
  return createHash('sha256')
    .update(`${Date.now()}-${Math.random()}`)
    .digest('hex');
}
