import type { Location } from '../../../api/locations';
import type { Product } from '../../../api/products';
import type { InboundOrderLine } from '../../../api/inbound';
import type { LineReceiveDraft, ReceivingLineRow } from './receiving-types';
import {
  computeLineStatus,
  formatDim,
  lineStatusLabel,
  parseQty,
  receivingExpectedLotDisplay,
} from './receiving-utils';

export type ReceivingPrintInput = {
  orderNumber: string;
  companyName: string;
  sourceLocation: string;
  destinationLocation: string;
  operatorNotes: string;
  assignedWorker: string;
  expectedArrival: string;
  specsProducts: Array<{
    sku: string;
    name: string;
    lengthCm: string;
    widthCm: string;
    heightCm: string;
    weightKg: string;
  }>;
  lines: ReceivingLineRow[];
  lineMap: Map<string, InboundOrderLine>;
  lineDrafts: Record<string, LineReceiveDraft>;
  locations: Location[];
};

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatStagingLocation(
  locationId: string | undefined,
  locations: Location[],
): string {
  if (!locationId?.trim()) return '—';
  const loc = locations.find((x) => x.id === locationId);
  return loc
    ? `${loc.fullPath}${loc.barcode ? ` · ${loc.barcode}` : ''}`
    : locationId;
}

/** Unique staging paths across receive lines (destination / dock). */
export function receivingDestinationLocationsSummary(
  lines: ReceivingLineRow[],
  locations: Location[],
): string {
  const ids = [...new Set(lines.map((l) => l.staging_location_id?.trim()).filter(Boolean))];
  if (ids.length === 0) return '—';
  return ids.map((id) => formatStagingLocation(id, locations)).join('; ');
}

export function buildReceivingPrintHtml(data: ReceivingPrintInput): string {
  const printedAt = new Date().toLocaleString();

  const specsSection =
    data.specsProducts.length === 0
      ? '<p class="muted">No products require spec validation on this receipt.</p>'
      : `<table class="data">
      <thead>
        <tr>
          <th>SKU</th>
          <th>Product</th>
          <th>Length (cm)</th>
          <th>Width (cm)</th>
          <th>Height (cm)</th>
          <th>Weight (kg)</th>
        </tr>
      </thead>
      <tbody>
        ${data.specsProducts
          .map(
            (p) => `<tr>
          <td class="mono">${esc(p.sku)}</td>
          <td>${esc(p.name)}</td>
          <td class="mono">${esc(p.lengthCm)}</td>
          <td class="mono">${esc(p.widthCm)}</td>
          <td class="mono">${esc(p.heightCm)}</td>
          <td class="mono">${esc(p.weightKg)}</td>
        </tr>`,
          )
          .join('')}
      </tbody>
    </table>`;

  const lineRows = data.lines
    .map((l) => {
      const lid = l.inbound_order_line_id;
      const ol = data.lineMap.get(lid);
      const d = data.lineDrafts[lid] ?? {
        receivedQty: '',
        damagedQty: '',
        notes: '',
        expiry: '',
      };
      const expected = parseQty(l.expected_qty);
      const received = parseQty(d.receivedQty);
      const damaged = parseQty(d.damagedQty);
      const missing = Math.max(0, expected - received - damaged);
      const status = lineStatusLabel(computeLineStatus(expected, received, damaged));
      const lineDest = formatStagingLocation(l.staging_location_id, data.locations);
      return `<tr>
        <td>${esc(ol?.product?.name ?? '—')}</td>
        <td class="mono">${esc(ol?.product?.sku ?? '—')}</td>
        <td class="mono">${esc(ol?.product?.barcode ?? '—')}</td>
        <td class="mono">${esc(receivingExpectedLotDisplay(ol))}</td>
        <td>${esc(lineDest)}</td>
        <td class="mono">${esc(l.expected_qty)}</td>
        <td class="mono">${esc(d.receivedQty || '—')}</td>
        <td class="mono">${esc(d.damagedQty || '—')}</td>
        <td class="mono">${String(missing)}</td>
        <td>${esc(status)}</td>
        <td class="mono">${esc(ol?.product?.expiryTracking ? d.expiry || '—' : '—')}</td>
        <td>${esc(d.notes || '—')}</td>
      </tr>`;
    })
    .join('');

  const notesBlock = data.operatorNotes.trim()
    ? `<p class="notes">${esc(data.operatorNotes.trim()).replace(/\n/g, '<br/>')}</p>`
    : '<p class="muted">—</p>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Receiving ${esc(data.orderNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, Segoe UI, sans-serif; color: #0f172a; margin: 0; padding: 20px; font-size: 12px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .meta { color: #475569; margin-bottom: 20px; font-size: 11px; }
    h2 { font-size: 14px; margin: 20px 0 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; margin-bottom: 8px; }
    .field label { display: block; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; margin-bottom: 2px; }
    .field div { font-size: 13px; }
    .notes { white-space: pre-wrap; margin: 0; line-height: 1.5; }
    .muted { color: #94a3b8; margin: 0; }
    table.data { width: 100%; border-collapse: collapse; font-size: 11px; }
    table.data th, table.data td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
    table.data th { background: #f1f5f9; font-weight: 600; }
    table.data td.mono { font-family: ui-monospace, monospace; font-size: 10px; }
    @media print {
      body { padding: 12px; }
      h2 { page-break-after: avoid; }
      table.data { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>Receiving worksheet · ${esc(data.orderNumber)}</h1>
  <p class="meta">${esc(data.companyName)} · ${esc(data.assignedWorker)} · Expected arrival: ${esc(data.expectedArrival)} · Printed ${esc(printedAt)}</p>

  <div class="grid">
    <div class="field">
      <label>Source location</label>
      <div>${esc(data.sourceLocation)}</div>
    </div>
    <div class="field">
      <label>Destination location</label>
      <div>${esc(data.destinationLocation)}</div>
    </div>
  </div>

  <h2>Operator notes</h2>
  ${notesBlock}

  <h2>Products — validate specs</h2>
  ${specsSection}

  <h2>Receive lines</h2>
  <table class="data">
    <thead>
      <tr>
        <th>Product</th>
        <th>SKU</th>
        <th>Barcode</th>
        <th>Lot</th>
        <th>Destination</th>
        <th>Expected</th>
        <th>Received</th>
        <th>Damaged</th>
        <th>Missing</th>
        <th>Status</th>
        <th>Expiry</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>
      ${lineRows || '<tr><td colspan="12" class="muted">No lines</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;
}

export function openReceivingPrintPdf(data: ReceivingPrintInput): boolean {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(buildReceivingPrintHtml(data));
  w.document.close();
  w.focus();
  w.print();
  return true;
}

export function buildReceivingPrintInput(opts: {
  orderNumber: string;
  companyName: string;
  operatorNotes: string;
  assignedWorker: string;
  expectedArrival: string;
  firstInboundProductIds: string[];
  productsById: Map<string, Product | undefined>;
  lines: ReceivingLineRow[];
  lineMap: Map<string, InboundOrderLine>;
  lineDrafts: Record<string, LineReceiveDraft>;
  locations: Location[];
}): ReceivingPrintInput {
  const destinationLocation = receivingDestinationLocationsSummary(opts.lines, opts.locations);
  const sourceLocation = opts.companyName.trim()
    ? `Inbound delivery · ${opts.companyName.trim()}`
    : 'Inbound delivery';

  const specsProducts = opts.firstInboundProductIds
    .map((pid) => {
      const p = opts.productsById.get(pid);
      if (!p) return null;
      return {
        sku: p.sku,
        name: p.name,
        lengthCm: formatDim(p.lengthCm),
        widthCm: formatDim(p.widthCm),
        heightCm: formatDim(p.heightCm),
        weightKg: formatDim(p.weightKg),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  return {
    orderNumber: opts.orderNumber,
    companyName: opts.companyName,
    sourceLocation,
    destinationLocation,
    operatorNotes: opts.operatorNotes,
    assignedWorker: opts.assignedWorker,
    expectedArrival: opts.expectedArrival,
    specsProducts,
    lines: opts.lines,
    lineMap: opts.lineMap,
    lineDrafts: opts.lineDrafts,
    locations: opts.locations,
  };
}
