-- BILLING-1B — Invoice calculation engine: freeze plan rates per billing cycle.

ALTER TABLE billing_cycles
    ADD COLUMN IF NOT EXISTS rate_snapshot JSONB NOT NULL DEFAULT '{}';

UPDATE billing_cycles bc
SET rate_snapshot = jsonb_build_object(
    'billingPlanId', bp.id::text,
    'fixedSubscriptionFee', bp.fixed_subscription_fee::text,
    'inboundOrderFee', bp.inbound_order_fee::text,
    'outboundOrderFee', bp.outbound_order_fee::text,
    'packagingFee', bp.packaging_fee::text,
    'qualityCheckFee', bp.quality_check_fee::text,
    'excessVolumeFeePerDay', bp.excess_volume_fee_per_day::text,
    'excessWeightFeePerDay', bp.excess_weight_fee_per_day::text,
    'reservedVolume', bp.reserved_volume::text,
    'reservedWeight', bp.reserved_weight::text,
    'snapshottedAt', NOW()::text
)
FROM billing_plans bp
WHERE bc.billing_plan_id = bp.id
  AND (bc.rate_snapshot = '{}'::jsonb OR bc.rate_snapshot IS NULL);

CREATE UNIQUE INDEX IF NOT EXISTS uq_invoice_line_type_per_invoice
    ON invoice_lines (invoice_id, type);
