import type { OutboundOrderLine } from '../../../api/outbound';
import type { Location } from '../../../api/locations';
import { esc, openTaskPrintHtml, taskPrintNotesBlock } from '../../../lib/task-print-html';
import type { PickLineDraft } from './pick-types';
import {
  computePickLineStatus,
  pickLineStatusLabel,
  locationDisplay,
} from './pick-utils';

export type PickPrintInput = {
  orderNumber: string;
  companyName: string;
  assignedWorker: string;
  dropOffLabel: string;
  dropOffLocation: string;
  shipBy: string;
  operatorNotes: string;
  drafts: PickLineDraft[];
  lineMeta: Map<string, OutboundOrderLine>;
  locationById: Map<string, Location>;
  lotNumberById: Map<string, string>;
};

export function buildPickPrintHtml(data: PickPrintInput): string {
  const printedAt = new Date().toLocaleString();
  const lineRows = data.drafts
    .map((d) => {
      const ol = data.lineMeta.get(d.outboundOrderLineId);
      const loc = data.locationById.get(d.locationId);
      const lot = d.lotId ? (data.lotNumberById.get(d.lotId) ?? d.lotId.slice(0, 8)) : '—';
      const status = pickLineStatusLabel(computePickLineStatus(d));
      return `<tr>
        <td class="mono">${esc(ol?.product?.sku ?? '—')}</td>
        <td>${esc(ol?.product?.name ?? '—')}</td>
        <td class="mono">${esc(locationDisplay(loc).shortLabel)}</td>
        <td class="mono">${esc(lot)}</td>
        <td class="mono">${esc(d.requiredQty)}</td>
        <td class="mono">${esc(d.pickedQty || '—')}</td>
        <td>${esc(status)}</td>
        <td>${esc(d.notes || '—')}</td>
      </tr>`;
    })
    .join('');

  return `
  <h1>Pick worksheet · ${esc(data.orderNumber)}</h1>
  <p class="meta">${esc(data.companyName)} · ${esc(data.assignedWorker)} · Ship by: ${esc(data.shipBy)} · Printed ${esc(printedAt)}</p>
  <div class="grid">
    <div class="field"><label>${esc(data.dropOffLabel)}</label><div>${esc(data.dropOffLocation)}</div></div>
    <div class="field"><label>Order</label><div class="mono">${esc(data.orderNumber)}</div></div>
  </div>
  <h2>Operator notes</h2>
  ${taskPrintNotesBlock(data.operatorNotes)}
  <h2>Pick lines</h2>
  <table class="data">
    <thead>
      <tr>
        <th>SKU</th><th>Product</th><th>Bin</th><th>Lot</th>
        <th>Required</th><th>Picked</th><th>Status</th><th>Notes</th>
      </tr>
    </thead>
    <tbody>${lineRows || '<tr><td colspan="8" class="muted">No lines</td></tr>'}</tbody>
  </table>`;
}

export function openPickPrintPdf(data: PickPrintInput): boolean {
  return openTaskPrintHtml(`Pick ${data.orderNumber}`, buildPickPrintHtml(data));
}
