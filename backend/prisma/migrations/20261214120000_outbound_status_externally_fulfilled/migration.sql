-- Canonical warehouse-skip status: fulfillment recorded outside WMS.
-- Usable for new orders (recordExternalFulfillment) and historical commercial-only rows.
ALTER TYPE outbound_order_status ADD VALUE IF NOT EXISTS 'externally_fulfilled';
