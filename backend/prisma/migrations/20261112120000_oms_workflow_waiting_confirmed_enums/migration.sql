-- Add new OMS commercial lifecycle statuses (schema only; no blind data remap).
ALTER TYPE "oms_order_status" ADD VALUE IF NOT EXISTS 'waiting_for_confirmation';
ALTER TYPE "oms_order_status" ADD VALUE IF NOT EXISTS 'confirmed_waiting_for_admin_approval';
