export type WaybillScanOrder = {
  orderNumber: string;
  trackingNumber?: string | null;
  /** Provider platform barcode (e.g. Sila) when distinct from courier tracking. */
  externalAwb?: string | null;
  linkedOutboundOrder?: {
    orderNumber?: string | null;
    trackingNumber?: string | null;
    externalAwb?: string | null;
  } | null;
};

export function normalizeWaybillScan(raw: string): string {
  let clean = raw.trim();
  if (!clean) return '';
  try {
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      const url = new URL(clean);
      const segments = url.pathname.split('/').filter(Boolean);
      const last = segments[segments.length - 1];
      if (last) clean = decodeURIComponent(last);
    }
  } catch {
    /* keep the raw code */
  }
  return clean.trim();
}

export function waybillScanAttempts(code: string): string[] {
  const attempts = [code];
  const stripped = code.replace(/^emd-/i, '');
  if (stripped && stripped !== code) attempts.push(stripped);
  return attempts;
}

export function orderMatchesWaybillScan(order: WaybillScanOrder, code: string): boolean {
  const needle = code.trim().toLowerCase();
  if (!needle) return false;
  const values = [
    order.orderNumber,
    order.trackingNumber,
    order.externalAwb,
    order.linkedOutboundOrder?.orderNumber,
    order.linkedOutboundOrder?.trackingNumber,
    order.linkedOutboundOrder?.externalAwb,
    `EMD-${order.orderNumber}`,
  ];
  return values.some((value) => value?.trim().toLowerCase() === needle);
}
