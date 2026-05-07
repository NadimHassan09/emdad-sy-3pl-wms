/** True when any line was closed with received quantity below expected (workflow may still be in progress). */
export function inboundHasQuantityShortfall(order: {
  lines: Array<{ expectedQuantity: string; receivedQuantity: string }>;
}): boolean {
  return order.lines.some((l) => {
    const exp = Number(l.expectedQuantity);
    const rec = Number(l.receivedQuantity);
    return rec + 1e-9 < exp;
  });
}
