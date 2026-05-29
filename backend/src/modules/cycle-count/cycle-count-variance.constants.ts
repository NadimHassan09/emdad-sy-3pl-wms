import { VarianceReasonCode } from '@prisma/client';

/** Supported variance reason codes (Phase 7.3). */
export const VARIANCE_REASON_CODES = [
  'damaged',
  'lost',
  'misplaced',
  'theft_suspected',
  'counting_mistake',
  'operational_correction',
  'unknown',
] as const satisfies readonly VarianceReasonCode[];

export const TERMINAL_VARIANCE_STATUSES = ['posted', 'rejected'] as const;

export function formatVarianceReasonLabel(code: VarianceReasonCode): string {
  return code.replace(/_/g, ' ');
}
