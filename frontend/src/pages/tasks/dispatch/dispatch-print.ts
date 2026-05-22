import type { OutboundOrderLine } from '../../../api/outbound';
import type { Location } from '../../../api/locations';
import { esc, openTaskPrintHtml, taskPrintNotesBlock } from '../../../lib/task-print-html';
import type { DispatchExecutionDraft, DispatchLineDraft } from './dispatch-types';

export type DispatchPrintInput = {
  orderNumber: string;
  companyName: string;
  assignedWorker: string;
  sourceLocation: string;
  destinationLocation: string;
  carrier: string;
  tracking: string;
  driverName: string;
  vehicleInfo: string;
  operatorNotes: string;
  dispatchNotes: string;
  lines: DispatchLineDraft[];
  lineMeta: Map<string, OutboundOrderLine>;
  draft: DispatchExecutionDraft;
};

export function buildDispatchPrintHtml(data: DispatchPrintInput): string {
  const printedAt = new Date().toLocaleString();
  const lineRows = data.lines
    .map((l) => {
      const ol = data.lineMeta.get(l.outboundOrderLineId);
      return `<tr>
        <td>${esc(ol?.product?.name ?? '—')}</td>
        <td class="mono">${esc(ol?.product?.sku ?? '—')}</td>
        <td class="mono">${esc(l.pickedQty)}</td>
        <td class="mono">${esc(l.shipQty)}</td>
        <td>${l.verified ? 'Yes' : 'No'}</td>
        <td>${esc(l.notes || '—')}</td>
      </tr>`;
    })
    .join('');

  const pkgRows = data.draft.packages
    .map(
      (p) => `<tr>
        <td class="mono">${esc(p.label)}</td>
        <td class="mono">${esc(p.weightKg || '—')}</td>
        <td>${p.scanned ? 'Loaded' : 'Pending'}</td>
      </tr>`,
    )
    .join('');

  return `
  <h1>Dispatch worksheet · ${esc(data.orderNumber)}</h1>
  <p class="meta">${esc(data.companyName)} · ${esc(data.assignedWorker)} · Printed ${esc(printedAt)}</p>
  <div class="grid">
    <div class="field"><label>Source</label><div>${esc(data.sourceLocation)}</div></div>
    <div class="field"><label>Destination (dock)</label><div>${esc(data.destinationLocation)}</div></div>
    <div class="field"><label>Carrier</label><div>${esc(data.carrier || '—')}</div></div>
    <div class="field"><label>Tracking</label><div class="mono">${esc(data.tracking || '—')}</div></div>
    <div class="field"><label>Driver</label><div>${esc(data.driverName || '—')}</div></div>
    <div class="field"><label>Vehicle</label><div>${esc(data.vehicleInfo || '—')}</div></div>
  </div>
  <h2>Operator notes</h2>
  ${taskPrintNotesBlock(data.operatorNotes)}
  <h2>Dispatch notes</h2>
  ${taskPrintNotesBlock(data.dispatchNotes)}
  <h2>Shipment lines</h2>
  <table class="data">
    <thead>
      <tr>
        <th>Product</th><th>SKU</th><th>Picked</th><th>Ship</th><th>Verified</th><th>Notes</th>
      </tr>
    </thead>
    <tbody>${lineRows || '<tr><td colspan="6" class="muted">No lines</td></tr>'}</tbody>
  </table>
  <h2>Packages</h2>
  <table class="data">
    <thead><tr><th>Label</th><th>Weight (kg)</th><th>Load status</th></tr></thead>
    <tbody>${pkgRows || '<tr><td colspan="3" class="muted">No packages</td></tr>'}</tbody>
  </table>`;
}

export function openDispatchPrintPdf(data: DispatchPrintInput): boolean {
  return openTaskPrintHtml(`Dispatch ${data.orderNumber}`, buildDispatchPrintHtml(data));
}

export function dispatchLocationLabel(loc: Location | undefined): string {
  if (!loc) return '—';
  return `${loc.fullPath}${loc.barcode ? ` · ${loc.barcode}` : ''}`;
}
