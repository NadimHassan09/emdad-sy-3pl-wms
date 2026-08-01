import{r as w,j as I}from"./vendor-react-Codo4t-7.js";import{a as C,c as K}from"./vendor-query-Cc15oKZm.js";import{L as P}from"./locations-ISIzn1dx.js";import{C as z}from"./Combobox-DIjGR2BZ.js";import{Q as q}from"./index-CN5JTe9v.js";import{p as H,d as E,c as F}from"./location-types-Csl2blQd.js";import{E as R,d as A,a as W,l as M}from"./location-resolve-DqSAmW_O.js";import{u as U}from"./ui-i18n-CuCe_Npd.js";import{o as X,e as m,t as Y}from"./task-print-html-DbkAk5GN.js";function p(t){const e=parseFloat(String(t??"").replace(",","."));return Number.isFinite(e)&&e>=0?e:0}function T(t){const e=String(t??"").trim();if(e==="")return{ok:!0,value:0};if(/^-/.test(e))return{ok:!1,reason:"negative"};const n=parseFloat(e.replace(",","."));return Number.isFinite(n)?n<0?{ok:!1,reason:"negative"}:{ok:!0,value:n}:{ok:!1,reason:"invalid"}}function ft(t,e,n){return Math.max(0,t-e-n)}function ht(t,e,n){const r=T(e);if(!r.ok)return r.reason==="negative"?"Received quantity cannot be negative.":"Received quantity must be a valid number.";const i=T(n);return i.ok?!(t>=0)||!Number.isFinite(t)?"Expected quantity is invalid.":r.value+i.value>t?`Received + damaged (${r.value+i.value}) exceeds expected (${t}).`:null:i.reason==="negative"?"Damaged quantity cannot be negative.":"Damaged quantity must be a valid number."}function G(t){var e,n;return!t||((e=t.product)==null?void 0:e.trackingType)!=="lot"?"—":((n=t.expectedLotNumber)==null?void 0:n.trim())||"—"}function B(t,e,n){const r=e+n;return r>t?"overage":n>0&&r<t?"damaged":r<=0?"pending":r<t?"shortage":r>=t?"complete":"partial"}function J(t){return{pending:"Pending",partial:"In progress",complete:"Complete",shortage:"Short",overage:"Overage",damaged:"Damage noted"}[t]}function bt(t){switch(t){case"complete":return"bg-status-success-bg text-brand-700";case"shortage":case"damaged":return"bg-status-warning-bg text-status-warning-fg";case"overage":return"bg-status-danger-bg text-status-danger-fg";case"partial":return"bg-surface-card-muted text-brand-700";default:return"bg-surface-card-muted text-text-body"}}function yt(t,e,n,r){const i=e.search.trim().toLowerCase();return t.filter(a=>{var L,v,g,b,f,N,y;const c=a.inbound_order_line_id,o=n.get(c),u=r[c]??{receivedQty:"",damagedQty:""},d=B(p(a.expected_qty),p(u.receivedQty),p(u.damagedQty));if(e.status&&d!==e.status)return!1;if(!i)return!0;const h=((v=(L=o==null?void 0:o.product)==null?void 0:L.sku)==null?void 0:v.toLowerCase())??"",x=((b=(g=o==null?void 0:o.product)==null?void 0:g.name)==null?void 0:b.toLowerCase())??"",$=((N=(f=o==null?void 0:o.product)==null?void 0:f.barcode)==null?void 0:N.toLowerCase())??"",S=((y=o==null?void 0:o.expectedLotNumber)==null?void 0:y.trim().toLowerCase())??"";return h.includes(i)||x.includes(i)||$.includes(i)||S.includes(i)})}function xt(t,e){let n=0,r=0,i=0;for(const o of t){const u=p(o.expected_qty),d=e[o.inbound_order_line_id];n+=u,r+=p(d==null?void 0:d.receivedQty),i+=p(d==null?void 0:d.damagedQty)}const a=Math.max(0,n-r-i),c=n>0?Math.min(100,Math.round((r+i)/n*100)):0;return{totalSkus:t.length,expectedTotal:n,receivedTotal:r,damagedTotal:i,remainingTotal:a,completionPct:c}}function vt(t,e,n,r,i){if(n>0||p(String((e==null?void 0:e.totalOnHand)??"0"))>0)return!1;for(const c of r)if(c.id!==i&&!(c.status!=="completed"&&c.status!=="partially_received")){for(const o of c.lines)if(o.productId===t&&p(o.receivedQuantity)>0)return!1}return!0}function k(t){if(t==null||t==="")return"—";const e=typeof t=="number"?t:parseFloat(String(t));return Number.isFinite(e)?String(e):String(t)}function V(t){if(!t)return"";const e=/damaged:([\d.]+)/i.exec(t);return e?e[1]:""}function j(t){if(!(t!=null&&t.trim()))return"";const e=t.trim();if(/^\d{4}-\d{2}-\d{2}/.test(e))return e.slice(0,10);const n=new Date(e);return Number.isNaN(n.getTime())?"":n.toISOString().slice(0,10)}function Z(t){if(!t)return"";const e=/expiry:(\d{4}-\d{2}-\d{2})/i.exec(t);return e?e[1]:""}function tt(t,e){var i;if(!((i=t==null?void 0:t.expectedLotNumber)!=null&&i.trim())||!(e!=null&&e.length))return"";const n=t.expectedLotNumber.trim().toLowerCase(),r=e.find(a=>a.lotNumber.trim().toLowerCase()===n);return j(r==null?void 0:r.expiryDate)}function $t(t,e){const n=e??(t==null?void 0:t.product);return n?n.trackingType==="lot"&&n.expiryTracking===!0:!1}function et(t,e,n){const r=e.expiry.trim();if(r)return r;if(!t)return"";const i=Z(t.discrepancyNotes);if(i)return i;const a=j(t.expectedExpiryDate);return a||tt(t,n)}function nt(t){return t?t.split(" · ").filter(e=>!/^damaged:/i.test(e)&&!/^expiry:/i.test(e)&&!/^attr-validated:/i.test(e)).join(" · ").trim():""}function Lt(t,e){const n=p(t.receivedQuantity),r=V(t.discrepancyNotes),i={expiry:""};return{receivedQty:n>0?String(n):"",damagedQty:r,notes:nt(t.discrepancyNotes),expiry:et(t,i,e)}}function St(t){const e=[],n=t.notes.trim();n&&e.push(n);const r=p(t.damagedQty);r>0&&e.push(`damaged:${r}`);const i=t.expiry.trim();return i&&e.push(`expiry:${i}`),e.length?e.join(" · "):void 0}function s(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function O(t,e){if(!(t!=null&&t.trim()))return"—";const n=e.find(r=>r.id===t);return n?`${n.fullPath}${n.barcode?` · ${n.barcode}`:""}`:t}function rt(t,e){const n=[...new Set(t.map(r=>{var i;return(i=r.staging_location_id)==null?void 0:i.trim()}).filter(Boolean))];return n.length===0?"—":n.map(r=>O(r,e)).join("; ")}function it(t){const e=new Date().toLocaleString(),n=t.specsProducts.length===0?'<p class="muted">No products require spec validation on this receipt.</p>':`<table class="data">
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
        ${t.specsProducts.map(a=>`<tr>
          <td class="mono">${s(a.sku)}</td>
          <td>${s(a.name)}</td>
          <td class="mono">${s(a.lengthCm)}</td>
          <td class="mono">${s(a.widthCm)}</td>
          <td class="mono">${s(a.heightCm)}</td>
          <td class="mono">${s(a.weightKg)}</td>
        </tr>`).join("")}
      </tbody>
    </table>`,r=t.lines.map(a=>{var v,g,b,f;const c=a.inbound_order_line_id,o=t.lineMap.get(c),u=t.lineDrafts[c]??{receivedQty:"",damagedQty:"",notes:"",expiry:""},d=p(a.expected_qty),h=p(u.receivedQty),x=p(u.damagedQty),$=Math.max(0,d-h-x),S=J(B(d,h,x)),L=O(a.staging_location_id,t.locations);return`<tr>
        <td>${s(((v=o==null?void 0:o.product)==null?void 0:v.name)??"—")}</td>
        <td class="mono">${s(((g=o==null?void 0:o.product)==null?void 0:g.sku)??"—")}</td>
        <td class="mono">${s(((b=o==null?void 0:o.product)==null?void 0:b.barcode)??"—")}</td>
        <td class="mono">${s(G(o))}</td>
        <td>${s(L)}</td>
        <td class="mono">${s(a.expected_qty)}</td>
        <td class="mono">${s(u.receivedQty||"—")}</td>
        <td class="mono">${s(u.damagedQty||"—")}</td>
        <td class="mono">${String($)}</td>
        <td>${s(S)}</td>
        <td class="mono">${s((f=o==null?void 0:o.product)!=null&&f.expiryTracking&&u.expiry||"—")}</td>
        <td>${s(u.notes||"—")}</td>
      </tr>`}).join(""),i=t.operatorNotes.trim()?`<p class="notes">${s(t.operatorNotes.trim()).replace(/\n/g,"<br/>")}</p>`:'<p class="muted">—</p>';return`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Receiving ${s(t.orderNumber)}</title>
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
  <h1>Receiving worksheet · ${s(t.orderNumber)}</h1>
  <p class="meta">${s(t.companyName)} · ${s(t.assignedWorker)} · Expected arrival: ${s(t.expectedArrival)} · Printed ${s(e)}</p>

  <div class="grid">
    <div class="field">
      <label>Source location</label>
      <div>${s(t.sourceLocation)}</div>
    </div>
    <div class="field">
      <label>Destination location</label>
      <div>${s(t.destinationLocation)}</div>
    </div>
  </div>

  <h2>Operator notes</h2>
  ${i}

  <h2>Products — validate specs</h2>
  ${n}

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
      ${r||'<tr><td colspan="12" class="muted">No lines</td></tr>'}
    </tbody>
  </table>
</body>
</html>`}function Nt(t){const e=window.open("","_blank");return e?(e.document.write(it(t)),e.document.close(),e.focus(),e.print(),!0):!1}function wt(t){const e=rt(t.lines,t.locations),n=t.companyName.trim()?`Inbound delivery · ${t.companyName.trim()}`:"Inbound delivery",r=t.firstInboundProductIds.map(i=>{const a=t.productsById.get(i);return a?{sku:a.sku,name:a.name,lengthCm:k(a.lengthCm),widthCm:k(a.widthCm),heightCm:k(a.heightCm),weightKg:k(a.weightKg)}:null}).filter(i=>i!=null);return{orderNumber:t.orderNumber,companyName:t.companyName,sourceLocation:n,destinationLocation:e,operatorNotes:t.operatorNotes,assignedWorker:t.assignedWorker,expectedArrival:t.expectedArrival,specsProducts:r,lines:t.lines,lineMap:t.lineMap,lineDrafts:t.lineDrafts,locations:t.locations}}function kt({warehouseId:t,taskType:e,value:n,onChange:r,disabled:i,dropdownInFlow:a=!0}){var v;const{t:c}=U(),[o,u]=w.useState("");w.useEffect(()=>{n||u("")},[n]);const d=w.useMemo(()=>H(e),[e]),h=C({queryKey:q.locations.byId(n),queryFn:()=>P.getById(n),enabled:!!n&&!!t,staleTime:5*6e4}),x=K({queries:d.map(g=>({queryKey:["locations","lookup","typed",t,g],queryFn:()=>P.lookup({warehouseId:t,type:g,status:"active",limit:R,offset:0}),enabled:!!t,staleTime:5*6e4}))}),$=C({queryKey:q.locations.putawayLookup(t,e,o),queryFn:()=>P.lookup({warehouseId:t,search:o.trim(),limit:R,offset:0,status:"active"}),enabled:!!t&&o.trim().length>=2,staleTime:3e4}),S=w.useMemo(()=>{var D,Q;const g=new Set(d),b=new Set,f=[],N=l=>{b.has(l.id)||l.status==="blocked"||l.status==="archived"||g.has(l.type)&&E(l.type,e)&&(b.add(l.id),f.push({value:l.id,label:l.fullPath,hint:`${F(l.type)} · ${l.barcode}`}))};for(const l of x)for(const _ of((D=l.data)==null?void 0:D.items)??[])N(_);for(const l of((Q=$.data)==null?void 0:Q.items)??[])N(l);f.sort((l,_)=>l.label.localeCompare(_.label));const y=h.data;return n&&y&&E(y.type,e)&&!b.has(n)&&f.unshift({value:y.id,label:y.fullPath,hint:`${F(y.type)} · ${y.barcode}`}),n&&!b.has(n)&&!y&&f.unshift({value:n,label:n,hint:c(["Loading…","جاري التحميل…"])}),f},[d,(v=$.data)==null?void 0:v.items,h.data,e,c,x,n]),L=x.some(g=>g.isLoading);return I.jsx(z,{value:n,onChange:r,options:S,placeholder:c(["Select storage bin…","اختر صندوق تخزين…"]),disabled:i,clearable:!0,dropdownInFlow:a,onSearchQueryChange:u,emptyMessage:L?c(["Loading locations…","جاري تحميل المواقع…"]):o.trim().length>=2&&$.isFetching?c(["Searching…","جاري البحث…"]):c(["No matching storage bins","لا توجد صناديق تخزين مطابقة"])})}function ot(t){const e=new Date().toLocaleString(),n=t.drafts.map(r=>{var d,h;const i=t.lineById.get(r.inbound_order_line_id),a=t.locationById.get(t.stagingByLineId.get(r.inbound_order_line_id)??""),c=t.locationById.get(r.destination_location_id),o=t.targetQty[r.inbound_order_line_id]??0,u=A(W(r,o));return`<tr>
        <td>${m(((d=i==null?void 0:i.product)==null?void 0:d.name)??"—")}</td>
        <td class="mono">${m(((h=i==null?void 0:i.product)==null?void 0:h.sku)??"—")}</td>
        <td class="mono">${m(M(a).shortLabel)}</td>
        <td class="mono">${m(M(c).fullPath)}</td>
        <td class="mono">${o}</td>
        <td class="mono">${m(r.putaway_quantity||"—")}</td>
        <td>${m(u)}</td>
        <td>${m(r.notes||"—")}</td>
      </tr>`}).join("");return`
  <h1>${m(t.taskLabel)} · ${m(t.orderNumber)}</h1>
  <p class="meta">${m(t.companyName)} · ${m(t.assignedWorker)} · Printed ${m(e)}</p>
  <div class="grid">
    <div class="field"><label>Source (staging)</label><div>${m(t.sourceSummary)}</div></div>
    <div class="field"><label>Destination (storage)</label><div>${m(t.destinationSummary)}</div></div>
  </div>
  <h2>Operator notes</h2>
  ${Y(t.operatorNotes)}
  <h2>Movement lines</h2>
  <table class="data">
    <thead>
      <tr>
        <th>Product</th><th>SKU</th><th>Source</th><th>Destination</th>
        <th>Target</th><th>Moved</th><th>Status</th><th>Notes</th>
      </tr>
    </thead>
    <tbody>${n||'<tr><td colspan="8" class="muted">No lines</td></tr>'}</tbody>
  </table>`}function _t(t){return X(`Putaway ${t.orderNumber}`,ot(t))}function Pt(t,e){const n=[...new Set(t.map(r=>{var i;return(i=r.destination_location_id)==null?void 0:i.trim()}).filter(Boolean))];return n.length===0?"—":n.map(r=>{const i=e.get(r);return i?`${i.fullPath}${i.barcode?` · ${i.barcode}`:""}`:r}).join("; ")}function Dt(t,e,n){const r=[...new Set(t.map(i=>e.get(i.inbound_order_line_id)).filter(Boolean))];return r.length===0?"—":r.map(i=>{const a=n.get(i);return a?`${a.fullPath}${a.barcode?` · ${a.barcode}`:""}`:i}).join("; ")}export{kt as P,_t as a,wt as b,Dt as c,p as d,yt as e,k as f,xt as g,$t as h,vt as i,B as j,bt as k,Lt as l,ft as m,G as n,Nt as o,Pt as p,St as q,et as r,ht as v};
