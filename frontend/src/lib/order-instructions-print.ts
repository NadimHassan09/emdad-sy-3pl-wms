import { esc, openTaskPrintHtml, TASK_PRINT_PAGE_STYLES } from './task-print-html';
import type { InboundOrder } from '../api/inbound';
import type { OutboundOrder } from '../api/outbound';
import type { InboundExecutionPlan, OutboundExecutionPlan } from './execution-plan';

export function openInboundInstructionsPdf(
  order: InboundOrder,
  locationLabels: Record<string, string> = {},
): boolean {
  const plan = (order.executionPlan ?? null) as InboundExecutionPlan | null;
  const rows = (order.lines ?? [])
    .map((l) => {
      const planLine =
        plan?.lines.find((p) => p.orderLineId === l.id) ??
        plan?.lines.find((p) => p.productId === l.productId);
      const splits = planLine?.putaway ?? [];
      const putawayHtml =
        splits.length === 0
          ? '—'
          : splits
              .map((s) => esc(locationLabels[s.locationId] ?? s.locationId))
              .join('<br/>');
      return `<tr>
        <td>${l.lineNumber}</td>
        <td class="mono">${esc(l.product?.sku ?? '—')}</td>
        <td>${esc(l.product?.name ?? '—')}</td>
        <td class="mono">${esc(String(l.expectedQuantity))}</td>
        <td>${putawayHtml}</td>
      </tr>`;
    })
    .join('');

  const dock = plan?.receivingDockId
    ? locationLabels[plan.receivingDockId] ?? plan.receivingDockId
    : '—';

  const html = `
    <style>${TASK_PRINT_PAGE_STYLES}</style>
    <h1>Inbound operational instructions</h1>
    <p class="meta">${esc(order.orderNumber)} · ${esc(order.company?.name ?? '—')} · Printed ${esc(new Date().toLocaleString())}</p>
    <div class="grid">
      <div class="field"><label>Client</label><div>${esc(order.company?.name ?? '—')}</div></div>
      <div class="field"><label>Expected arrival</label><div>${esc(new Date(order.expectedArrivalDate).toLocaleDateString())}</div></div>
      <div class="field"><label>Receiving dock</label><div>${esc(dock)}</div></div>
      <div class="field"><label>Execution</label><div>Admin</div></div>
    </div>
    <h2>Products &amp; storage plan</h2>
    <table class="data">
      <thead><tr><th>#</th><th>SKU</th><th>Product</th><th>Qty</th><th>Putaway</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <h2>Notes</h2>
    <p class="notes">${esc(order.notes?.trim() || '—')}</p>
    <p class="meta" style="margin-top:24px">After physical work, return to the order and click Confirm order.</p>
  `;
  return openTaskPrintHtml(`${order.orderNumber} instructions`, html);
}

export function openOutboundInstructionsPdf(
  order: OutboundOrder,
  locationLabels: Record<string, string> = {},
): boolean {
  const plan = (order.executionPlan ?? null) as OutboundExecutionPlan | null;
  const picks = plan?.suggestedPicks ?? [];
  const pickRows =
    picks.length > 0
      ? picks
          .map(
            (p) => `<tr>
          <td class="mono">${esc(p.productId)}</td>
          <td>${esc(p.locationPath ?? locationLabels[p.locationId] ?? p.locationId)}</td>
          <td class="mono">${esc(String(p.qty))}</td>
        </tr>`,
          )
          .join('')
      : (order.lines ?? [])
          .map(
            (l) => `<tr>
          <td class="mono">${esc(l.product?.sku ?? '—')}</td>
          <td colspan="1">${esc(l.product?.name ?? '—')}</td>
          <td class="mono">${esc(String(l.requestedQuantity))}</td>
        </tr>`,
          )
          .join('');

  const html = `
    <style>${TASK_PRINT_PAGE_STYLES}</style>
    <h1>Outbound operational instructions</h1>
    <p class="meta">${esc(order.orderNumber)} · ${esc(order.company?.name ?? '—')} · Printed ${esc(new Date().toLocaleString())}</p>
    <div class="grid">
      <div class="field"><label>Client</label><div>${esc(order.company?.name ?? '—')}</div></div>
      <div class="field"><label>Ship date</label><div>${esc(new Date(order.requiredShipDate).toLocaleDateString())}</div></div>
      <div class="field"><label>Packing</label><div>${order.requiresPacking ? 'Required' : 'Not required'}</div></div>
      <div class="field"><label>Execution</label><div>Admin</div></div>
    </div>
    <h2>Products &amp; suggested picking</h2>
    <table class="data">
      <thead><tr><th>SKU / Product</th><th>Location</th><th>Qty</th></tr></thead>
      <tbody>${pickRows}</tbody>
    </table>
    <h2>Notes</h2>
    <p class="notes">${esc(order.notes?.trim() || '—')}</p>
    <p class="meta" style="margin-top:24px">Follow suggested locations, then Confirm order to complete all tasks.</p>
  `;
  return openTaskPrintHtml(`${order.orderNumber} instructions`, html);
}
