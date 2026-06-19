import type {
  BillingInvoiceLineRow,
  BillingInvoiceLineType,
  BillingRateSnapshot,
} from '../api/billing';
import {
  formatDate,
  formatDecimal,
  humanizeInvoiceStatus,
  lineTotalByType,
  renewalStatusLabel,
} from './billing-invoice-display';
import { esc, openTaskPrintHtml } from './task-print-html';

const LINE_TYPE_ORDER: BillingInvoiceLineType[] = [
  'subscription',
  'inbound',
  'outbound',
  'packaging',
  'quality_check',
  'excess_volume',
  'excess_weight',
];

const LINE_TYPE_LABELS: Record<BillingInvoiceLineType, string> = {
  subscription: 'Fixed subscription',
  inbound: 'Inbound totals',
  outbound: 'Outbound totals',
  packaging: 'Packaging totals',
  quality_check: 'Quality check totals',
  excess_volume: 'Volume charges',
  excess_weight: 'Weight charges',
};

export type BillingInvoicePrintInput = {
  invoiceNumber: string;
  companyName: string;
  status: string;
  cycle?: {
    startsAt: string;
    endsAt: string;
    status?: string;
  };
  createdAt: string;
  issuedAt: string | null;
  totalAmount: string;
  lines: BillingInvoiceLineRow[];
  snapshot: BillingRateSnapshot | null;
  daysRemaining?: number | null;
  previewNote?: string;
  usageSummary?: {
    usedVolumeCbm: string;
    allocatedVolumeCbm: string;
    usedWeightKg: string;
    allocatedWeightKg: string;
  };
};

function snapshotField(label: string, value: string): string {
  return `<div class="field"><label>${esc(label)}</label><div>${esc(value)}</div></div>`;
}

function buildChargeRows(lines: BillingInvoiceLineRow[]): string {
  return LINE_TYPE_ORDER.map((type) => {
    const amount = lineTotalByType(lines, type);
    return `<tr>
      <td>${esc(LINE_TYPE_LABELS[type])}</td>
      <td class="mono">${esc(formatDecimal(amount))}</td>
    </tr>`;
  }).join('');
}

function buildDetailedLineRows(lines: BillingInvoiceLineRow[]): string {
  if (lines.length === 0) {
    return '<tr><td colspan="4" class="muted">No line items</td></tr>';
  }
  return [...lines]
    .sort(
      (a, b) =>
        LINE_TYPE_ORDER.indexOf(a.type) - LINE_TYPE_ORDER.indexOf(b.type) ||
        a.type.localeCompare(b.type),
    )
    .map(
      (line) => `<tr>
        <td>${esc(LINE_TYPE_LABELS[line.type] ?? line.type.replace(/_/g, ' '))}</td>
        <td class="mono">${esc(formatDecimal(line.quantity, 4))}</td>
        <td class="mono">${esc(formatDecimal(line.unitPrice, 4))}</td>
        <td class="mono">${esc(formatDecimal(line.totalPrice))}</td>
      </tr>`,
    )
    .join('');
}

function formatCycleRange(cycle?: { startsAt: string; endsAt: string }): string {
  if (!cycle) return '—';
  const start = new Date(cycle.startsAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const end = new Date(cycle.endsAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${start} – ${end}`;
}

export function buildBillingInvoicePrintHtml(data: BillingInvoicePrintInput): string {
  const printedAt = new Date().toLocaleString();
  const cycleLabel = formatCycleRange(data.cycle);
  const daysRemaining =
    data.daysRemaining == null
      ? '—'
      : data.daysRemaining > 0
        ? `${data.daysRemaining} days`
        : 'Expired';

  const snapshotGrid = data.snapshot
    ? [
        snapshotField('Fixed subscription fee', formatDecimal(data.snapshot.fixedSubscriptionFee)),
        snapshotField('Inbound order fee', formatDecimal(data.snapshot.inboundOrderFee, 4)),
        snapshotField('Outbound order fee', formatDecimal(data.snapshot.outboundOrderFee, 4)),
        snapshotField('Packaging fee', formatDecimal(data.snapshot.packagingFee, 4)),
        snapshotField('Quality check fee', formatDecimal(data.snapshot.qualityCheckFee, 4)),
        snapshotField('Excess volume / day', formatDecimal(data.snapshot.excessVolumeFeePerDay, 4)),
        snapshotField('Excess weight / day', formatDecimal(data.snapshot.excessWeightFeePerDay, 4)),
        snapshotField('Reserved volume', `${formatDecimal(data.snapshot.reservedVolume, 4)} CBM`),
        snapshotField('Reserved weight', `${formatDecimal(data.snapshot.reservedWeight, 4)} kg`),
        data.snapshot.snapshottedAt
          ? snapshotField('Snapshotted at', formatDate(data.snapshot.snapshottedAt))
          : '',
      ].join('')
    : '<p class="muted">No rate snapshot on this billing cycle.</p>';

  const usageBlock = data.usageSummary
    ? `<h2>Usage</h2>
  <div class="grid">
    ${snapshotField(
      'Used / allocated CBM',
      `${formatDecimal(data.usageSummary.usedVolumeCbm, 2)} / ${formatDecimal(data.usageSummary.allocatedVolumeCbm, 2)}`,
    )}
    ${snapshotField(
      'Used / allocated kg',
      `${formatDecimal(data.usageSummary.usedWeightKg, 2)} / ${formatDecimal(data.usageSummary.allocatedWeightKg, 2)}`,
    )}
  </div>`
    : '';

  const previewNote = data.previewNote
    ? `<p class="meta">${esc(data.previewNote)}</p>`
    : '';

  return `
  <h1>Billing invoice · ${esc(data.invoiceNumber)}</h1>
  <p class="meta">${esc(data.companyName)} · ${esc(humanizeInvoiceStatus(data.status))} · Printed ${esc(printedAt)}</p>
  ${previewNote}
  <div class="grid">
    <div class="field"><label>Client</label><div>${esc(data.companyName)}</div></div>
    <div class="field"><label>Invoice number</label><div class="mono">${esc(data.invoiceNumber)}</div></div>
    <div class="field"><label>Billing cycle</label><div>${esc(cycleLabel)}</div></div>
    <div class="field"><label>Status</label><div>${esc(humanizeInvoiceStatus(data.status))}</div></div>
    <div class="field"><label>Created</label><div>${esc(formatDate(data.createdAt))}</div></div>
    <div class="field"><label>Issued</label><div>${esc(data.issuedAt ? formatDate(data.issuedAt) : '—')}</div></div>
    <div class="field"><label>Cycle status</label><div>${esc(renewalStatusLabel(data.cycle?.status))}</div></div>
    <div class="field"><label>Days remaining</label><div>${esc(daysRemaining)}</div></div>
  </div>
  ${usageBlock}
  <h2>Billing plan snapshot</h2>
  <div class="grid">${snapshotGrid}</div>
  <h2>Invoice charges</h2>
  <table class="data">
    <thead><tr><th>Charge</th><th>Amount</th></tr></thead>
    <tbody>${buildChargeRows(data.lines)}</tbody>
    <tfoot>
      <tr>
        <th>Grand total</th>
        <th class="mono">${esc(formatDecimal(data.totalAmount))}</th>
      </tr>
    </tfoot>
  </table>
  <h2>Line detail</h2>
  <table class="data">
    <thead>
      <tr><th>Charge</th><th>Quantity</th><th>Unit price</th><th>Total</th></tr>
    </thead>
    <tbody>${buildDetailedLineRows(data.lines)}</tbody>
  </table>`;
}

export function openBillingInvoicePrintPdf(data: BillingInvoicePrintInput): boolean {
  return openTaskPrintHtml(`Invoice ${data.invoiceNumber}`, buildBillingInvoicePrintHtml(data));
}
