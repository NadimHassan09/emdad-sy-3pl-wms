function a(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}const i=`
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
`;function n(t){return t.trim()?`<p class="notes">${a(t.trim()).replace(/\n/g,"<br/>")}</p>`:'<p class="muted">—</p>'}function r(t,o){const e=window.open("","_blank");return e?(e.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${a(t)}</title>
  <style>${i}</style>
</head>
<body>
${o}
</body>
</html>`),e.document.close(),e.focus(),e.print(),!0):!1}export{a as e,r as o,n as t};
