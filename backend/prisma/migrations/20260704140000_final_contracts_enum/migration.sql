-- Add final_contract to document_type enum (must be committed before use in indexes).

ALTER TYPE "document_type" ADD VALUE IF NOT EXISTS 'final_contract';
