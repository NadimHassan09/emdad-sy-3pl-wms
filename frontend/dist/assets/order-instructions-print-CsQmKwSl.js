import{r as w,j as c}from"./vendor-react-ESlAFUXX.js";import{a as M,u as L,b as T}from"./vendor-query-CkBKI8gF.js";import{D}from"./documents-ju6W40Zd.js";import{b as G,i as Q}from"./index-B5TGqvfo.js";import{B as K}from"./Button-TbfMYtGV.js";import{a as _}from"./FilterPanel-CMZ-DEFS.js";import{e as i,T as S,o as C}from"./task-print-html-jZy3QOx5.js";function B(){return typeof window<"u"&&(window.localStorage.getItem("wms-ui-language")==="AR"||document.documentElement.dir==="rtl")}const H=["en","ar"];function O(t){return["completed","done","shipped","approved","closed"].includes(t)}function et({referenceType:t,referenceId:l,companyIdOverride:a,showPanel:h=!0}){var A;const $=B(),k=G(),g=M(),[y,m]=w.useState(null),e=(s,o)=>$?o:s,r=["documents",t,l],u=t==="inbound_order"?"grn":"delivery_note",f=t==="inbound_order"?"receiving":"dispatch",b=L({queryKey:r,queryFn:()=>D.list(t,l),enabled:!!l}),v=L({queryKey:["workflow-timeline",t,l,a??""],queryFn:()=>Q.getTimeline(t,l,a),enabled:!!l}),p=T({mutationFn:({type:s,taskId:o,lang:n})=>s==="grn"?D.generateGrn(o,n):D.generateDn(o,n)}),N=w.useMemo(()=>{var n;return(((n=v.data)==null?void 0:n.tasks)??[]).filter(d=>d.taskType===f&&O(d.status)).sort((d,x)=>{const F=d.completedAt?new Date(d.completedAt).getTime():0;return(x.completedAt?new Date(x.completedAt).getTime():0)-F})[0]},[(A=v.data)==null?void 0:A.tasks,f]),I=w.useMemo(()=>{const s=new Map;for(const n of b.data??[]){if(!n.taskId)continue;const d=`${n.type}:${n.taskId}`,x=s.get(d)??{type:n.type,taskId:n.taskId,number:n.documentNumber,byLang:new Map};x.byLang.set(n.language,n),n.language==="en"&&(x.number=n.documentNumber),s.set(d,x)}const o=[...s.values()];if(N){const n=`${u}:${N.id}`;s.has(n)||o.unshift({type:u,taskId:N.id,number:"",byLang:new Map})}return o},[b.data,u,N]),R=s=>s==="grn"?e("Goods Receipt Note (GRN)","سند استلام بضاعة (GRN)"):e("Delivery Note (DN)","سند تسليم (DN)"),P=s=>s==="en"?e("English","إنجليزي"):e("Arabic","عربي"),q=async(s,o)=>{const n=`${s.type}:${s.taskId}:${o}`;m(n);try{const d=await p.mutateAsync({type:s.type,taskId:s.taskId,lang:o});await g.invalidateQueries({queryKey:r}),d!=null&&d.id&&await D.openInNewTab(d.id)}catch(d){k.error(d.message)}finally{m(null)}},E=t==="inbound_order"?e("Complete the receiving task to generate a Goods Receipt Note (GRN).","أكمل مهمة الاستلام لإنشاء سند استلام البضاعة (GRN)."):e("Complete the dispatch task to generate a Delivery Note (DN).","أكمل مهمة التسليم لإنشاء سند التسليم (DN)."),j=b.isLoading||v.isLoading?c.jsx("p",{className:"text-sm text-text-muted",children:e("Loading…","جارٍ التحميل…")}):I.length===0?h?c.jsx("p",{className:"text-sm text-text-muted",children:E}):null:c.jsx("div",{className:"space-y-2",children:I.map(s=>c.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-card px-4 py-3",children:[c.jsxs("div",{className:"flex items-center gap-3",children:[c.jsx("span",{className:"inline-flex h-9 w-9 items-center justify-center rounded-md bg-[#EAF6F0] text-[#0B5E3C]",children:c.jsxs("svg",{width:"18",height:"18",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[c.jsx("path",{d:"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"}),c.jsx("polyline",{points:"14 2 14 8 20 8"})]})}),c.jsxs("div",{children:[c.jsx("div",{className:"text-sm font-semibold text-text-strong",children:R(s.type)}),c.jsx("div",{className:"font-mono text-xs text-text-muted",children:s.number||e("Not generated yet","لم يُنشأ بعد")})]})]}),c.jsx("div",{className:"flex items-center gap-2",children:H.map(o=>{const n=s.byLang.get(o),d=`${s.type}:${s.taskId}:${o}`;return c.jsx(K,{size:"sm",variant:n?"secondary":"primary",loading:y===d,onClick:()=>q(s,o),children:n?`${e("Open PDF","فتح PDF")} · ${P(o)}`:`${e("Create PDF","إنشاء PDF")} · ${P(o)}`},o)})})]},`${s.type}:${s.taskId}`))});return h?c.jsx(_,{title:e("Documents","المستندات"),variant:"content",children:j}):j||null}function st(t,l={}){var g,y,m;const a=t.executionPlan??null,h=(t.lines??[]).map(e=>{var b,v;const r=(a==null?void 0:a.lines.find(p=>p.orderLineId===e.id))??(a==null?void 0:a.lines.find(p=>p.productId===e.productId)),u=(r==null?void 0:r.putaway)??[],f=u.length===0?"—":u.map(p=>i(l[p.locationId]??p.locationId)).join("<br/>");return`<tr>
        <td>${e.lineNumber}</td>
        <td class="mono">${i(((b=e.product)==null?void 0:b.sku)??"—")}</td>
        <td>${i(((v=e.product)==null?void 0:v.name)??"—")}</td>
        <td class="mono">${i(String(e.expectedQuantity))}</td>
        <td>${f}</td>
      </tr>`}).join(""),$=a!=null&&a.receivingDockId?l[a.receivingDockId]??a.receivingDockId:"—",k=`
    <style>${S}</style>
    <h1>Inbound operational instructions</h1>
    <p class="meta">${i(t.orderNumber)} · ${i(((g=t.company)==null?void 0:g.name)??"—")} · Printed ${i(new Date().toLocaleString())}</p>
    <div class="grid">
      <div class="field"><label>Client</label><div>${i(((y=t.company)==null?void 0:y.name)??"—")}</div></div>
      <div class="field"><label>Expected arrival</label><div>${i(new Date(t.expectedArrivalDate).toLocaleDateString())}</div></div>
      <div class="field"><label>Receiving dock</label><div>${i($)}</div></div>
      <div class="field"><label>Execution</label><div>Admin</div></div>
    </div>
    <h2>Products &amp; storage plan</h2>
    <table class="data">
      <thead><tr><th>#</th><th>SKU</th><th>Product</th><th>Qty</th><th>Putaway</th></tr></thead>
      <tbody>${h}</tbody>
    </table>
    <h2>Notes</h2>
    <p class="notes">${i(((m=t.notes)==null?void 0:m.trim())||"—")}</p>
    <p class="meta" style="margin-top:24px">After physical work, return to the order and click Confirm order.</p>
  `;return C(`${t.orderNumber} instructions`,k)}function nt(t,l={}){var g,y,m;const a=t.executionPlan??null,h=(a==null?void 0:a.suggestedPicks)??[],$=h.length>0?h.map(e=>`<tr>
          <td class="mono">${i(e.productId)}</td>
          <td>${i(e.locationPath??l[e.locationId]??e.locationId)}</td>
          <td class="mono">${i(String(e.qty))}</td>
        </tr>`).join(""):(t.lines??[]).map(e=>{var r,u;return`<tr>
          <td class="mono">${i(((r=e.product)==null?void 0:r.sku)??"—")}</td>
          <td colspan="1">${i(((u=e.product)==null?void 0:u.name)??"—")}</td>
          <td class="mono">${i(String(e.requestedQuantity))}</td>
        </tr>`}).join(""),k=`
    <style>${S}</style>
    <h1>Outbound operational instructions</h1>
    <p class="meta">${i(t.orderNumber)} · ${i(((g=t.company)==null?void 0:g.name)??"—")} · Printed ${i(new Date().toLocaleString())}</p>
    <div class="grid">
      <div class="field"><label>Client</label><div>${i(((y=t.company)==null?void 0:y.name)??"—")}</div></div>
      <div class="field"><label>Ship date</label><div>${i(new Date(t.requiredShipDate).toLocaleDateString())}</div></div>
      <div class="field"><label>Packing</label><div>${t.requiresPacking?"Required":"Not required"}</div></div>
      <div class="field"><label>Execution</label><div>Admin</div></div>
    </div>
    <h2>Products &amp; suggested picking</h2>
    <table class="data">
      <thead><tr><th>SKU / Product</th><th>Location</th><th>Qty</th></tr></thead>
      <tbody>${$}</tbody>
    </table>
    <h2>Notes</h2>
    <p class="notes">${i(((m=t.notes)==null?void 0:m.trim())||"—")}</p>
    <p class="meta" style="margin-top:24px">Follow suggested locations, then Confirm order to complete all tasks.</p>
  `;return C(`${t.orderNumber} instructions`,k)}export{et as O,nt as a,st as o};
