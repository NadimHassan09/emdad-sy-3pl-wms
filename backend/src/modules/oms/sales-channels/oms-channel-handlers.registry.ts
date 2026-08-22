import { OmsSalesChannelType } from '@prisma/client';

import type { OmsChannelHandler } from './oms-channel.util';

const stubHandler =
  (label: string): OmsChannelHandler =>
  async (ctx) => ({
    accepted: true,
    externalId:
      typeof ctx.payload.id === 'string'
        ? ctx.payload.id
        : typeof ctx.payload.order_id === 'string'
          ? ctx.payload.order_id
          : undefined,
    message: `${label} payload accepted (handler stub — map to CreateOmsOrderDto next)`,
  });

/** Registry for channel-specific order ingestion (Shopify, Salla, etc.). */
export const OMS_CHANNEL_HANDLERS: Record<OmsSalesChannelType, OmsChannelHandler> = {
  shopify: stubHandler('Shopify'),
  woocommerce: stubHandler('WooCommerce'),
  salla: stubHandler('Salla'),
  zid: stubHandler('Zid'),
  custom_rest: stubHandler('Custom REST'),
};

export function resolveChannelHandler(type: OmsSalesChannelType): OmsChannelHandler {
  return OMS_CHANNEL_HANDLERS[type] ?? OMS_CHANNEL_HANDLERS.custom_rest;
}
