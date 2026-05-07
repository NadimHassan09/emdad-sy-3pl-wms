import { ConfigService } from '@nestjs/config';

/** When true, `receiveLine` updates line qty only — no ledger / staging stock (putaway moves stock). */
export function inboundReceiveDefersPutaway(config: ConfigService): boolean {
  return (config.get<string>('TASK_WORKFLOW_INBOUND_RECEIVE_DEFERS_PUTAWAY') ?? '').toLowerCase() === 'true';
}

/** When true, order confirm skips stock decrement; deduction happens on workflow dispatch completion. */
export function outboundConfirmDefersDeduction(config: ConfigService): boolean {
  return (
    (config.get<string>('TASK_WORKFLOW_OUTBOUND_CONFIRM_DEFERS_DEDUCTION') ?? '').toLowerCase() === 'true'
  );
}

/** Unified flag: confirms start task-only workflows; disables legacy receive/deduct shortcuts. */
export function taskOnlyFlows(config: ConfigService): boolean {
  const raw = (config.get<string>('TASK_ONLY_FLOWS') ?? '').trim().toLowerCase();
  if (raw === 'false' || raw === '0' || raw === 'no' || raw === 'off') return false;
  return true;
}
