import type { OutboundOrderLine } from '../../../api/outbound';
import { esc, openTaskPrintHtml, taskPrintNotesBlock } from '../../../lib/task-print-html';
import type { PackLineDraft, PackPackageDraft } from './pack-types';
import {
  computePackLineStatus,
  packLineStatusLabel,
  parseQty,
  primaryPackageLabelForLine,
} from './pack-utils';

export type PackPrintInput = {
  orderNumber: string;
  companyName: string;
  assignedWorker: string;
  packingStation: string;
  shipTo: string;
  shipBy: string;
  operatorNotes: string;
  lines: PackLineDraft[];
  lineMeta: Map<string, OutboundOrderLine>;
  packages: PackPackageDraft[];
};

export function buildPackPrintHtml(data: PackPrintInput): string {
  const printedAt = new Date().toLocaleString();
  const lineRows = data.lines
    .map((l) => {
      const ol = data.lineMeta.get(l.outboundOrderLineId);
      const pkg =
        primaryPackageLabelForLine(data.packages, l.outboundOrderLineId) ?? '—';
      const remaining = Math.max(0, parseQty(l.pickedQty) - parseQty(l.packedQty));
      const status = packLineStatusLabel(computePackLineStatus(l));
      return `<tr>
        <td class="mono">${esc(ol?.product?.sku ?? '—')}</td>
        <td>${esc(ol?.product?.name ?? '—')}</td>
        <td class="mono">${esc(ol?.product?.barcode ?? '—')}</td>
        <td class="mono">${esc(l.pickedQty)}</td>
        <td class="mono">${esc(l.packedQty || '—')}</td>
        <td class="mono">${remaining}</td>
        <td>${esc(pkg)}</td>
        <td>${esc(status)}</td>
      </tr>`;
    })
    .join('');

  const pkgRows = data.packages
    .map(
      (p) => `<tr>
        <td class="mono">${esc(p.label)}</td>
        <td>${esc(p.packageType)}</td>
        <td class="mono">${esc(p.weightKg || '—')}</td>
        <td>${esc(p.status)}</td>
        <td class="mono">${p.items.reduce((s, i) => s + parseQty(i.quantity), 0)}</td>
      </tr>`,
    )
    .join('');

  return `
  <h1>Pack worksheet · ${esc(data.orderNumber)}</h1>
  <p class="meta">${esc(data.companyName)} · ${esc(data.assignedWorker)} · Ship by: ${esc(data.shipBy)} · Printed ${esc(printedAt)}</p>
  <div class="grid">
    <div class="field"><label>Packing station</label><div>${esc(data.packingStation)}</div></div>
    <div class="field"><label>Ship to</label><div>${esc(data.shipTo)}</div></div>
  </div>
  <h2>Operator notes</h2>
  ${taskPrintNotesBlock(data.operatorNotes)}
  <h2>Pack lines</h2>
  <table class="data">
    <thead>
      <tr>
        <th>SKU</th><th>Product</th><th>Barcode</th><th>Picked</th>
        <th>Packed</th><th>Remaining</th><th>Package</th><th>Status</th>
      </tr>
    </thead>
    <tbody>${lineRows || '<tr><td colspan="8" class="muted">No lines</td></tr>'}</tbody>
  </table>
  <h2>Packages</h2>
  <table class="data">
    <thead>
      <tr><th>Label</th><th>Type</th><th>Weight (kg)</th><th>Status</th><th>Units</th></tr>
    </thead>
    <tbody>${pkgRows || '<tr><td colspan="5" class="muted">No packages</td></tr>'}</tbody>
  </table>`;
}

export function openPackPrintPdf(data: PackPrintInput): boolean {
  return openTaskPrintHtml(`Pack ${data.orderNumber}`, buildPackPrintHtml(data));
}
