-- Soft-assigned carrier quote amount/currency from Shipping Details (batch cost analysis).
ALTER TABLE "outbound_orders"
  ADD COLUMN IF NOT EXISTS "shipping_quoted_price" DECIMAL(15,4),
  ADD COLUMN IF NOT EXISTS "shipping_quoted_currency" VARCHAR(8);
