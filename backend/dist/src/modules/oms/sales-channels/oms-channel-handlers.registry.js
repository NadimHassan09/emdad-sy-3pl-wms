"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OMS_CHANNEL_HANDLERS = void 0;
exports.resolveChannelHandler = resolveChannelHandler;
const stubHandler = (label) => async (ctx) => ({
    accepted: true,
    externalId: typeof ctx.payload.id === 'string'
        ? ctx.payload.id
        : typeof ctx.payload.order_id === 'string'
            ? ctx.payload.order_id
            : undefined,
    message: `${label} payload accepted (handler stub — map to CreateOmsOrderDto next)`,
});
exports.OMS_CHANNEL_HANDLERS = {
    shopify: stubHandler('Shopify'),
    woocommerce: stubHandler('WooCommerce'),
    salla: stubHandler('Salla'),
    zid: stubHandler('Zid'),
    custom_rest: stubHandler('Custom REST'),
};
function resolveChannelHandler(type) {
    return exports.OMS_CHANNEL_HANDLERS[type] ?? exports.OMS_CHANNEL_HANDLERS.custom_rest;
}
//# sourceMappingURL=oms-channel-handlers.registry.js.map