import type { InboundOrderLine } from '../../../api/inbound';
import type { Location } from '../../../api/locations';
import { esc, openTaskPrintHtml, taskPrintNotesBlock } from '../../../lib/task-print-html';
import type { PutawayLineDraft } from './putaway-types';
import {
  computeLineStatus,
  lineStatusLabel,
  locationDisplay,
} from './putaway-utils';

export type PutawayPrintInput = {
  taskLabel: string;
  orderNumber: string;
  companyName: string;
  assignedWorker: string;
  sourceSummary: string;
  destinationSummary: string;
  operatorNotes: string;
  drafts: PutawayLineDraft[];
  lineById: Map<string, InboundOrderLine>;
  stagingByLineId: Map<string, string>;
  locationById: Map<string, Location>;
  targetQty: Record<string, number>;
};

export function buildPutawayPrintHtml(data: PutawayPrintInput): string {
  const printedAt = new Date().toLocaleString();
  const lineRows = data.drafts
    .map((d) => {
      const ol = data.lineById.get(d.inbound_order_line_id);
      const src = data.locationById.get(
        data.stagingByLineId.get(d.inbound_order_line_id) ?? '',
      );
      const dest = data.locationById.get(d.destination_location_id);
      const target = data.targetQty[d.inbound_order_line_id] ?? 0;
      const status = lineStatusLabel(
        computeLineStatus(d, target),
      );
      return `<tr>
        <td>${esc(ol?.product?.name ?? '—')}</td>
        <td class="mono">${esc(ol?.product?.sku ?? '—')}</td>
        <td class="mono">${esc(locationDisplay(src).shortLabel)}</td>
        <td class="mono">${esc(locationDisplay(dest).fullPath)}</td>
        <td class="mono">${target}</td>
        <td class="mono">${esc(d.putaway_quantity || '—')}</td>
        <td>${esc(status)}</td>
        <td>${esc(d.notes || '—')}</td>
      </tr>`;
    })
    .join('');

  return `
  <h1>${esc(data.taskLabel)} · ${esc(data.orderNumber)}</h1>
  <p class="meta">${esc(data.companyName)} · ${esc(data.assignedWorker)} · Printed ${esc(printedAt)}</p>
  <div class="grid">
    <div class="field"><label>Source (staging)</label><div>${esc(data.sourceSummary)}</div></div>
    <div class="field"><label>Destination (storage)</label><div>${esc(data.destinationSummary)}</div></div>
  </div>
  <h2>Operator notes</h2>
  ${taskPrintNotesBlock(data.operatorNotes)}
  <h2>Movement lines</h2>
  <table class="data">
    <thead>
      <tr>
        <th>Product</th><th>SKU</th><th>Source</th><th>Destination</th>
        <th>Target</th><th>Moved</th><th>Status</th><th>Notes</th>
      </tr>
    </thead>
    <tbody>${lineRows || '<tr><td colspan="8" class="muted">No lines</td></tr>'}</tbody>
  </table>`;
}

export function openPutawayPrintPdf(data: PutawayPrintInput): boolean {
  return openTaskPrintHtml(
    `Putaway ${data.orderNumber}`,
    buildPutawayPrintHtml(data),
  );
}

export function putawayDestinationSummary(
  drafts: PutawayLineDraft[],
  locationById: Map<string, Location>,
): string {
  const ids = [...new Set(drafts.map((d) => d.destination_location_id?.trim()).filter(Boolean))];
  if (ids.length === 0) return '—';
  return ids
    .map((id) => {
      const loc = locationById.get(id);
      return loc
        ? `${loc.fullPath}${loc.barcode ? ` · ${loc.barcode}` : ''}`
        : id;
    })
    .join('; ');
}

export function putawaySourceSummary(
  drafts: PutawayLineDraft[],
  stagingByLineId: Map<string, string>,
  locationById: Map<string, Location>,
): string {
  const ids = [...new Set(drafts.map((d) => stagingByLineId.get(d.inbound_order_line_id)).filter(Boolean))];
  if (ids.length === 0) return '—';
  return ids
    .map((id) => {
      const loc = locationById.get(id!);
      return loc
        ? `${loc.fullPath}${loc.barcode ? ` · ${loc.barcode}` : ''}`
        : id!;
    })
    .join('; ');
}
