import{h as c,r as p,l as g}from"./billing-invoice-display-DvU1AErL.js";import{o as b,e as t}from"./task-print-html-Cj7Z0H4f.js";import{a as s,f as l}from"./billing-plan-overview-CiozVDqx.js";const a=["subscription","inbound","outbound","packaging","quality_check","excess_volume","excess_weight"],d={subscription:"Fixed subscription",inbound:"Inbound totals",outbound:"Outbound totals",packaging:"Packaging totals",quality_check:"Quality check totals",excess_volume:"Volume charges",excess_weight:"Weight charges"};function n(e,i){return`<div class="field"><label>${t(e)}</label><div>${t(i)}</div></div>`}function y(e){return a.map(i=>{const o=g(e,i);return`<tr>
      <td>${t(d[i])}</td>
      <td class="mono">${t(s(o))}</td>
    </tr>`}).join("")}function $(e){return e.length===0?'<tr><td colspan="4" class="muted">No line items</td></tr>':[...e].sort((i,o)=>a.indexOf(i.type)-a.indexOf(o.type)||i.type.localeCompare(o.type)).map(i=>`<tr>
        <td>${t(d[i.type]??i.type.replace(/_/g," "))}</td>
        <td class="mono">${t(s(i.quantity,4))}</td>
        <td class="mono">${t(s(i.unitPrice,4))}</td>
        <td class="mono">${t(s(i.totalPrice))}</td>
      </tr>`).join("")}function f(e){if(!e)return"—";const i=new Date(e.startsAt).toLocaleDateString(void 0,{month:"short",day:"numeric",year:"numeric"}),o=new Date(e.endsAt).toLocaleDateString(void 0,{month:"short",day:"numeric",year:"numeric"});return`${i} – ${o}`}function x(e){var r;const i=new Date().toLocaleString(),o=f(e.cycle),u=e.daysRemaining==null?"—":e.daysRemaining>0?`${e.daysRemaining} days`:"Expired",h=e.snapshot?[n("Fixed subscription fee",s(e.snapshot.fixedSubscriptionFee)),n("Inbound order fee",s(e.snapshot.inboundOrderFee,4)),n("Outbound order fee",s(e.snapshot.outboundOrderFee,4)),n("Packaging fee",s(e.snapshot.packagingFee,4)),n("Quality check fee",s(e.snapshot.qualityCheckFee,4)),n("Excess volume / day",s(e.snapshot.excessVolumeFeePerDay,4)),n("Excess weight / day",s(e.snapshot.excessWeightFeePerDay,4)),n("Reserved volume",`${s(e.snapshot.reservedVolume,4)} CBM`),n("Reserved weight",`${s(e.snapshot.reservedWeight,4)} kg`),e.snapshot.snapshottedAt?n("Snapshotted at",l(e.snapshot.snapshottedAt)):""].join(""):'<p class="muted">No rate snapshot on this billing cycle.</p>',m=e.usageSummary?`<h2>Usage</h2>
  <div class="grid">
    ${n("Used / allocated CBM",`${s(e.usageSummary.usedVolumeCbm,2)} / ${s(e.usageSummary.allocatedVolumeCbm,2)}`)}
    ${n("Used / allocated kg",`${s(e.usageSummary.usedWeightKg,2)} / ${s(e.usageSummary.allocatedWeightKg,2)}`)}
  </div>`:"",v=e.previewNote?`<p class="meta">${t(e.previewNote)}</p>`:"";return`
  <h1>Billing invoice · ${t(e.invoiceNumber)}</h1>
  <p class="meta">${t(e.companyName)} · ${t(c(e.status))} · Printed ${t(i)}</p>
  ${v}
  <div class="grid">
    <div class="field"><label>Client</label><div>${t(e.companyName)}</div></div>
    <div class="field"><label>Invoice number</label><div class="mono">${t(e.invoiceNumber)}</div></div>
    <div class="field"><label>Billing cycle</label><div>${t(o)}</div></div>
    <div class="field"><label>Status</label><div>${t(c(e.status))}</div></div>
    <div class="field"><label>Created</label><div>${t(l(e.createdAt))}</div></div>
    <div class="field"><label>Issued</label><div>${t(e.issuedAt?l(e.issuedAt):"—")}</div></div>
    <div class="field"><label>Cycle status</label><div>${t(p((r=e.cycle)==null?void 0:r.status))}</div></div>
    <div class="field"><label>Days remaining</label><div>${t(u)}</div></div>
  </div>
  ${m}
  <h2>Billing plan snapshot</h2>
  <div class="grid">${h}</div>
  <h2>Invoice charges</h2>
  <table class="data">
    <thead><tr><th>Charge</th><th>Amount</th></tr></thead>
    <tbody>${y(e.lines)}</tbody>
    <tfoot>
      <tr>
        <th>Grand total</th>
        <th class="mono">${t(s(e.totalAmount))}</th>
      </tr>
    </tfoot>
  </table>
  <h2>Line detail</h2>
  <table class="data">
    <thead>
      <tr><th>Charge</th><th>Quantity</th><th>Unit price</th><th>Total</th></tr>
    </thead>
    <tbody>${$(e.lines)}</tbody>
  </table>`}function C(e){return b(`Invoice ${e.invoiceNumber}`,x(e))}export{C as o};
