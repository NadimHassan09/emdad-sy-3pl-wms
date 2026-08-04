-- Remap legacy OMS statuses to commercial lifecycle (after pending enum committed)
UPDATE oms_orders SET status = 'pending'
WHERE status::text IN (
  'approved', 'confirmed', 'processing', 'allocated',
  'picking', 'packing', 'ready_to_ship', 'shipped', 'failed_delivery'
);

UPDATE oms_orders SET status = 'delivered'
WHERE status::text = 'completed';

UPDATE oms_orders SET status = 'cancelled'
WHERE status::text = 'rejected';
