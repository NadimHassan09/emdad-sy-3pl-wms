-- Bulk shipping processing jobs (Admin-only convenience over existing carrier handoff).

CREATE TYPE "bulk_shipping_job_status" AS ENUM (
  'pending',
  'processing',
  'completed',
  'completed_with_errors',
  'failed',
  'cancelled'
);

CREATE TYPE "bulk_shipping_item_status" AS ENUM (
  'pending',
  'processing',
  'succeeded',
  'skipped',
  'failed'
);

CREATE TABLE "bulk_shipping_jobs" (
  "id" UUID NOT NULL,
  "status" "bulk_shipping_job_status" NOT NULL DEFAULT 'pending',
  "triggered_by_user_id" UUID NOT NULL,
  "total_count" INTEGER NOT NULL,
  "success_count" INTEGER NOT NULL DEFAULT 0,
  "failed_count" INTEGER NOT NULL DEFAULT 0,
  "skipped_count" INTEGER NOT NULL DEFAULT 0,
  "progress_percent" SMALLINT NOT NULL DEFAULT 0,
  "estimated_total_cost" DECIMAL(15,4),
  "estimated_currency" TEXT,
  "error_message" TEXT,
  "started_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "bulk_shipping_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bulk_shipping_job_items" (
  "id" UUID NOT NULL,
  "job_id" UUID NOT NULL,
  "outbound_order_id" UUID NOT NULL,
  "status" "bulk_shipping_item_status" NOT NULL DEFAULT 'pending',
  "selected_provider_code" TEXT NOT NULL,
  "recommended_provider_code" TEXT,
  "quoted_price" DECIMAL(15,4),
  "quoted_currency" TEXT,
  "external_awb" TEXT,
  "label_capability" VARCHAR(32),
  "last_error_safe" TEXT,
  "processed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "bulk_shipping_job_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_bulk_shipping_jobs_status_created" ON "bulk_shipping_jobs"("status", "created_at" DESC);
CREATE INDEX "idx_bulk_shipping_jobs_triggered_by" ON "bulk_shipping_jobs"("triggered_by_user_id", "created_at" DESC);
CREATE UNIQUE INDEX "uq_bulk_shipping_job_item_order" ON "bulk_shipping_job_items"("job_id", "outbound_order_id");
CREATE INDEX "idx_bulk_shipping_job_items_job_status" ON "bulk_shipping_job_items"("job_id", "status");
CREATE INDEX "idx_bulk_shipping_job_items_outbound" ON "bulk_shipping_job_items"("outbound_order_id");

ALTER TABLE "bulk_shipping_jobs"
  ADD CONSTRAINT "bulk_shipping_jobs_triggered_by_user_id_fkey"
  FOREIGN KEY ("triggered_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bulk_shipping_job_items"
  ADD CONSTRAINT "bulk_shipping_job_items_job_id_fkey"
  FOREIGN KEY ("job_id") REFERENCES "bulk_shipping_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bulk_shipping_job_items"
  ADD CONSTRAINT "bulk_shipping_job_items_outbound_order_id_fkey"
  FOREIGN KEY ("outbound_order_id") REFERENCES "outbound_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
