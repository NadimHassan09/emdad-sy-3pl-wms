-- Waiting for Shipping Details stage (post-pack, pre-dispatch).
-- ready_to_ship remains Waiting for Dispatch only.

ALTER TYPE outbound_order_status ADD VALUE IF NOT EXISTS 'waiting_for_shipping_details' BEFORE 'ready_to_ship';

ALTER TYPE warehouse_task_type ADD VALUE IF NOT EXISTS 'shipping_details' BEFORE 'dispatch';

ALTER TYPE workflow_step_kind ADD VALUE IF NOT EXISTS 'shipping_details' BEFORE 'dispatch';
