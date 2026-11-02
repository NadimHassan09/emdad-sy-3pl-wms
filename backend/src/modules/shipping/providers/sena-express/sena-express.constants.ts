export const SENA_EXPRESS_BASE_URL =
  process.env.SENA_EXPRESS_BASE_URL?.trim() || 'https://syria.sena-express.com/api/v1/merchant';

export const SENA_WEBHOOK_EVENTS = [
  'webhook.test',
  'shipment.created',
  'shipment.status.updated',
  'shipment.out_for_delivery',
  'shipment.delivered',
  'shipment.delivery_failed',
  'shipment.in_return',
  'shipment.returned_to_sender',
  'shipment.cancelled',
] as const;

export type SenaWebhookEventType = (typeof SENA_WEBHOOK_EVENTS)[number];

export const SENA_STATUSES = [
  'pending',
  'awaiting_pickup',
  'awaiting_address_confirmation',
  'customer_confirmed',
  'out_for_delivery',
  'delivered',
  'client_no_response',
  'customer_not_responding',
  'phone_off',
  'rescheduled',
  'refused',
  'delivery_attempts_completed',
  'in_return',
  'returned_to_sender',
  'shipment_problem',
  'damaged',
  'lost',
  'cancelled',
] as const;

export type SenaShipmentStatus = (typeof SENA_STATUSES)[number];
