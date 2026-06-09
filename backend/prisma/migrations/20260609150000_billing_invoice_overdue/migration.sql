-- BILLING-4B: add overdue invoice status
ALTER TYPE billing_invoice_status ADD VALUE IF NOT EXISTS 'overdue';
