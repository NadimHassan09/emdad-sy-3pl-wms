import { WarehouseTaskType } from '@prisma/client';

import { BillingRecalcTrigger } from './billing-recalculation.types';

export function billingTriggerForWarehouseTask(args: {
  taskType: WarehouseTaskType;
  inboundCompleted: boolean;
  outboundCompleted: boolean;
}): BillingRecalcTrigger | null {
  if (args.inboundCompleted) return 'inbound_completed';
  if (args.outboundCompleted) return 'outbound_completed';
  if (args.taskType === 'pack') return 'packaging_completed';
  if (args.taskType === 'qc') return 'quality_check_completed';
  if (
    args.taskType === 'receiving' ||
    args.taskType === 'putaway' ||
    args.taskType === 'putaway_quarantine' ||
    args.taskType === 'dispatch'
  ) {
    return 'usage_changed';
  }
  return null;
}
