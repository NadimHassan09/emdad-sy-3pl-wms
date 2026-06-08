import { BillingInvoiceLineType } from '@prisma/client';

export type BillingRecalcTrigger =
  | 'inbound_completed'
  | 'outbound_completed'
  | 'packaging_completed'
  | 'quality_check_completed'
  | 'usage_changed'
  | 'cycle_started'
  | 'scheduled_usage';

export const ALL_BILLING_LINE_TYPES: BillingInvoiceLineType[] = [
  'subscription',
  'inbound',
  'outbound',
  'packaging',
  'quality_check',
  'excess_volume',
  'excess_weight',
];

export type BillingLineComputation = {
  type: BillingInvoiceLineType;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
};

export type BillingRecalcResult = {
  invoiceId: string;
  billingCycleId: string;
  companyId: string;
  totalAmount: string;
  lines: BillingLineComputation[];
  trigger: BillingRecalcTrigger;
};
