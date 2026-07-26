/**
 * OMS order soft-delete / archive rules.
 * Only cancelled orders may be deleted; completed and active statuses stay for audit.
 */

export function isOmsOrderDeletable(status: string | null | undefined): boolean {
  return status === 'cancelled';
}

export function omsOrderDeleteBlockedMessage(status: string | null | undefined): string {
  if (status === 'completed') {
    return (
      'Completed OMS orders cannot be deleted. ' +
      'They must remain available for audit and traceability.'
    );
  }
  const label = status?.trim() ? status : 'unknown';
  return (
    `Only cancelled OMS orders can be deleted. ` +
    `This order is "${label}" and must stay available for operational history.`
  );
}
