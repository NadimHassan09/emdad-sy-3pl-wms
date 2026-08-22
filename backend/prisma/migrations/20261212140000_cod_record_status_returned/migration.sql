-- New COD lifecycle status for fully returned orders.
ALTER TYPE cod_record_status ADD VALUE IF NOT EXISTS 'returned';
