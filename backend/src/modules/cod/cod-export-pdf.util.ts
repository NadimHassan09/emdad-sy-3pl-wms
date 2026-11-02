import {
  COD_DETAIL_HEADERS,
  COD_SUMMARY_HEADERS,
  buildCodReportView,
  collectionStatusLabel,
  displayOrderNumber,
  displayRecipientName,
  parseCodAmount,
  payoutStatusLabel,
  roundMoney,
  type CodCurrencySummary,
  type CodExportRecord,
  type CodReportView,
} from './cod-export.util';

export type CodPdfBrand = {
  companyName: string;
  companyNameAr: string;
  tagline: string;
  logoDataUri: string;
  fontFaceCss: string;
};

const DEFAULT_BRAND: Omit<CodPdfBrand, 'logoDataUri' | 'fontFaceCss'> = {
  companyName: 'EMDAD Logistics & Warehousing',
  companyNameAr: 'إمداد للخدمات اللوجستية والتخزين',
  tagline: 'Logistics & Warehousing',
};

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatCodReportDate(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(
    date.getUTCHours(),
  )}:${pad(date.getUTCMinutes())}`;
}

export function formatCodMoney(value: number): string {
  return roundMoney(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function summaryRows(view: CodReportView): CodCurrencySummary[] {
  if (view.summary.byCurrency.length > 0) return view.summary.byCurrency;
  return [
    {
      currency: '—',
      recordCount: 0,
      collected: 0,
      paidOut: 0,
      collectedUnpaid: 0,
      uncollected: 0,
      returned: 0,
    },
  ];
}

export function buildCodPdfFooterTemplate(companyName: string): string {
  const safe = escapeHtml(companyName);
  return `<div style="width:100%;font-family:'Cairo',Arial,sans-serif;font-size:8px;color:#555555;padding:0 12mm;box-sizing:border-box;">
    <div style="border-top:1px solid #0B5E3C;padding-top:3px;display:flex;justify-content:space-between;align-items:center;gap:8px;">
      <span style="color:#08452c;font-weight:700;">${safe}</span>
      <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
    </div>
  </div>`;
}

export function buildCodReportHtml(params: {
  records: CodExportRecord[];
  clientLabel: string;
  brand: CodPdfBrand;
}): string {
  const view = buildCodReportView(params.records, params.clientLabel);
  const brand = { ...DEFAULT_BRAND, ...params.brand };
  const logo = brand.logoDataUri
    ? `<img class="logo" src="${brand.logoDataUri}" alt="EMDAD" />`
    : '';

  const summaryBody = summaryRows(view)
    .map(
      (row) => `<tr>
        <td class="center">${escapeHtml(row.currency)}</td>
        <td class="center">${row.recordCount}</td>
        <td class="num">${formatCodMoney(row.collected)}</td>
        <td class="num">${formatCodMoney(row.paidOut)}</td>
        <td class="num">${formatCodMoney(row.collectedUnpaid)}</td>
        <td class="num">${formatCodMoney(row.uncollected)}</td>
        <td class="num">${formatCodMoney(row.returned)}</td>
      </tr>`,
    )
    .join('');

  const detailBody =
    view.records.length === 0
      ? `<tr class="empty-row"><td colspan="7">No COD records match the current filters.</td></tr>`
      : view.records
          .map(
            (record) => `<tr>
        <td class="order-id">${escapeHtml(displayOrderNumber(record))}</td>
        <td class="name">${escapeHtml(displayRecipientName(record))}</td>
        <td class="num">${formatCodMoney(parseCodAmount(record.currentAmount))}</td>
        <td class="center">${escapeHtml(collectionStatusLabel(record.status))}</td>
        <td class="center">${escapeHtml(payoutStatusLabel(record.status))}</td>
        <td class="center nowrap">${escapeHtml(formatCodReportDate(record.availableAt))}</td>
        <td class="center nowrap">${escapeHtml(formatCodReportDate(record.paidOutAt))}</td>
      </tr>`,
          )
          .join('');

  const summaryHead = COD_SUMMARY_HEADERS.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const detailHead = COD_DETAIL_HEADERS.map((h) => `<th>${escapeHtml(h)}</th>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>COD Report</title>
  <style>
    ${brand.fontFaceCss}
    * { box-sizing: border-box; }
    @page { size: A4 landscape; }
    html, body {
      margin: 0;
      padding: 0;
      color: #222222;
      font-family: 'Cairo', 'Noto Naskh Arabic', Arial, sans-serif;
      font-size: 11px;
      line-height: 1.35;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 16px;
      padding-bottom: 10px;
      border-bottom: 3px solid #08452c;
      margin-bottom: 12px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .logo { height: 54px; width: auto; display: block; }
    .brand-copy { min-width: 0; }
    .brand-name { font-size: 18px; font-weight: 700; color: #08452c; }
    .brand-name-ar { font-size: 13px; color: #0b5e3c; margin-top: 1px; }
    .brand-tag { font-size: 10px; color: #5b6b63; margin-top: 2px; }
    .report-title {
      margin: 10px 0 6px;
      font-size: 16px;
      font-weight: 700;
      color: #08452c;
      page-break-after: avoid;
    }
    .client-line {
      margin: 0 0 14px;
      font-size: 13px;
      page-break-after: avoid;
    }
    .client-line span { color: #5b6b63; font-weight: 600; }
    .client-line strong { color: #08452c; font-size: 14px; }
    .section-title {
      margin: 0 0 6px;
      font-size: 12px;
      font-weight: 700;
      color: #08452c;
      page-break-after: avoid;
    }
    table.report {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    table.report thead { display: table-header-group; }
    table.report tbody { display: table-row-group; }
    table.report tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    table.report th, table.report td {
      padding: 7px 8px;
      border: 1px solid #c5d5cc;
      vertical-align: middle;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    table.report th {
      background: #08452c;
      color: #ffffff;
      font-weight: 700;
      text-align: left;
      font-size: 10px;
    }
    table.summary { margin-bottom: 16px; }
    table.summary th { background: #0b5e3c; }
    table.summary col.currency { width: 10%; }
    table.summary col.records { width: 9%; }
    table.detail col.order { width: 16%; }
    table.detail col.name { width: 22%; }
    table.detail col.amount { width: 12%; }
    table.detail col.status { width: 13%; }
    table.detail col.payout { width: 14%; }
    table.detail col.date { width: 11.5%; }
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      font-weight: 700;
    }
    .center { text-align: center; }
    .nowrap { white-space: nowrap; }
    .name { text-align: left; unicode-bidi: isolate; }
    .order-id { font-weight: 700; color: #08452c; overflow-wrap: break-word; word-break: break-word; }
    .empty-row td {
      text-align: center;
      color: #66736c;
      padding: 16px 8px;
      font-style: italic;
    }
  </style>
</head>
<body>
  <header class="brand">
    ${logo}
    <div class="brand-copy">
      <div class="brand-name">${escapeHtml(brand.companyName)}</div>
      <div class="brand-name-ar">${escapeHtml(brand.companyNameAr)}</div>
      <div class="brand-tag">${escapeHtml(brand.tagline)}</div>
    </div>
  </header>
  <h1 class="report-title">COD Report</h1>
  <p class="client-line"><span>Client</span> · <strong>${escapeHtml(view.clientLabel)}</strong></p>
  <h2 class="section-title">Financial summary</h2>
  <table class="report summary">
    <colgroup>
      <col class="currency" /><col class="records" /><col /><col /><col /><col /><col />
    </colgroup>
    <thead><tr>${summaryHead}</tr></thead>
    <tbody>${summaryBody}</tbody>
  </table>
  <h2 class="section-title">COD records</h2>
  <table class="report detail">
    <colgroup>
      <col class="order" /><col class="name" /><col class="amount" /><col class="status" /><col class="payout" /><col class="date" /><col class="date" />
    </colgroup>
    <thead><tr>${detailHead}</tr></thead>
    <tbody>${detailBody}</tbody>
  </table>
</body>
</html>`;
}
