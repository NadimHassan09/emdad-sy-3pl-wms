-- Client-submitted orders await warehouse approval before normal workflow.
ALTER TYPE inbound_order_status ADD VALUE IF NOT EXISTS 'pending_approval';
ALTER TYPE outbound_order_status ADD VALUE IF NOT EXISTS 'pending_approval';
