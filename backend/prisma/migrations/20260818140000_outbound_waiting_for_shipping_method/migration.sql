-- Add waiting_for_shipping_method between packing and waiting_for_shipping_details.
ALTER TYPE "outbound_order_status" ADD VALUE IF NOT EXISTS 'waiting_for_shipping_method' AFTER 'packing';
