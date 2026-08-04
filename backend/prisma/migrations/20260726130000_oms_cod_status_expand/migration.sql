ALTER TYPE "oms_cod_status" ADD VALUE IF NOT EXISTS 'partially_collected';
ALTER TYPE "oms_cod_status" ADD VALUE IF NOT EXISTS 'failed';
ALTER TYPE "oms_cod_status" ADD VALUE IF NOT EXISTS 'refunded';
ALTER TYPE "oms_cod_status" ADD VALUE IF NOT EXISTS 'cancelled';
