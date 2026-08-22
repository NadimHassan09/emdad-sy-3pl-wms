/** `clientReference` prefix for one-step quick directed outbound orders. */
export const QUICK_DIRECTED_OUTBOUND_REF_PREFIX = 'QDO-';

export function isQuickDirectedOutboundClientReference(
  clientReference: string | null | undefined,
): boolean {
  return (clientReference ?? '').startsWith(QUICK_DIRECTED_OUTBOUND_REF_PREFIX);
}

export function quickDirectedReasonFromClientReference(
  clientReference: string | null | undefined,
): string | null {
  if (!isQuickDirectedOutboundClientReference(clientReference)) return null;
  return (clientReference ?? '').slice(QUICK_DIRECTED_OUTBOUND_REF_PREFIX.length) || null;
}
