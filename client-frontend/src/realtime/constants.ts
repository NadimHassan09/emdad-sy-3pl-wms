/** Must match `backend/src/modules/realtime/realtime.events.ts`. */
export const RealtimeEvents = {
  INBOUND_ORDER_CREATED: 'order.inbound.created',
  INBOUND_ORDER_UPDATED: 'order.inbound.updated',
  OUTBOUND_ORDER_CREATED: 'order.outbound.created',
  OUTBOUND_ORDER_UPDATED: 'order.outbound.updated',
  TASK_UPDATED: 'task.updated',
  INVENTORY_CHANGED: 'inventory.changed',
  PRODUCT_CREATED: 'product.created',
  PRODUCT_UPDATED: 'product.updated',
  PRODUCT_ARCHIVED: 'product.archived',
  NOTIFICATION_CREATED: 'notification.created',
  NOTIFICATION_READ: 'notification.read',
  NOTIFICATION_DELETED: 'notification.deleted',
} as const;
