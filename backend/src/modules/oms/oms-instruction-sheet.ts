import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type InstructionPlace = {
  /** Location name shown as the primary label. */
  name: string;
  /** Path/code shown in the secondary badge. Empty when it would repeat the name. */
  code: string;
};

export type InstructionPickRow = {
  sku: string;
  name: string;
  quantity: string;
  locationName: string;
  locationCode: string;
};

export type InstructionSheet = {
  orderNumber: string;
  orderDate: string;
  clientName: string;
  operatorName: string;
  /** Null when packing is not part of this order. */
  packingLocation: InstructionPlace | null;
  dispatchLocation: InstructionPlace;
  picks: InstructionPickRow[];
  pickNote?: string;
};

export const logoDataUri = readDataUri('image/png', join('..', '..', 'pdf', 'assets', 'logo.png'));
export const fontFace = (() => {
  const font = readDataUri('font/ttf', join('..', '..', 'pdf', 'assets', 'fonts', 'Cairo.ttf'));
  if (!font) return '';
  return `@font-face{font-family:'Cairo';font-style:normal;font-weight:100 900;font-display:swap;src:url(${font}) format('truetype');}`;
})();

function readDataUri(mime: string, relativePath: string): string {
  try {
    const buf = readFileSync(join(__dirname, relativePath));
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return '';
  }
}

export function compareOmsOrderNumbers(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
}

export function safeInstructionFilename(orderNumber: string): string {
  const cleaned = orderNumber.trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-');
  return cleaned || 'order';
}

export function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function icon(name: 'file' | 'user' | 'calendar' | 'cart' | 'box' | 'truck' | 'pin' | 'package'): string {
  const paths: Record<typeof name, string> = {
    file: '<path d="M7 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5Z"/><path d="M14 3.5V8h4.5"/><path d="M8.5 12h7M8.5 15.5h7"/>',
    user: '<circle cx="12" cy="8" r="3.2"/><path d="M5.5 19.2c.8-3 3.2-4.6 6.5-4.6s5.7 1.6 6.5 4.6"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M8 3.5v4M16 3.5v4M4 10h16"/>',
    cart: '<path d="M4 5h2.2l1.6 9.2a1.5 1.5 0 0 0 1.5 1.2H17"/><path d="M8.2 14.4h9.2L19 8H7"/><circle cx="10" cy="19" r="1.3"/><circle cx="16.5" cy="19" r="1.3"/>',
    box: '<path d="M4 8.2 12 4.5l8 3.7v8.1L12 19.5 4 16.3V8.2Z"/><path d="M12 12.2 20 8.4M12 12.2V19.5M12 12.2 4 8.4"/>',
    truck: '<path d="M3.5 8.5h10v7.5h-10z"/><path d="M13.5 11h3.2l2.3 2.6v2.4h-5.5"/><circle cx="7.2" cy="17.6" r="1.5"/><circle cx="16.2" cy="17.6" r="1.5"/>',
    pin: '<path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"/><circle cx="12" cy="11" r="2.1"/>',
    package: '<path d="M4.5 8 12 4.6 19.5 8 12 11.4 4.5 8Z"/><path d="M4.5 8v8L12 19.4 19.5 16V8"/><path d="M12 11.4V19.4"/>',
  };
  return `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
}

function codeBadge(code: string): string {
  const value = code.trim();
  if (!value) return '';
  return `<span class="code">(${esc(value)})</span>`;
}

function placeValue(place: InstructionPlace): string {
  return `<span class="place-chip"><span class="place-name">${esc(place.name || '—')}</span>${codeBadge(place.code)}</span>`;
}

function sheetHtml(sheet: InstructionSheet): string {
  const rows =
    sheet.picks.length > 0
      ? sheet.picks
          .map(
            (row, index) => `<tr>
              <td class="idx">${index + 1}</td>
              <td class="sku">${esc(row.sku || '—')}</td>
              <td class="product">${esc(row.name || '—')}</td>
              <td class="qty">${esc(row.quantity || '—')}</td>
              <td class="loc">
                <div class="loc-name">${esc(row.locationName || '—')}</div>
                ${codeBadge(row.locationCode)}
              </td>
              <td class="notes">—</td>
            </tr>`,
          )
          .join('')
      : `<tr><td class="empty" colspan="6">لم يتم تحديد مواقع الالتقاط بعد.<span>Pick locations are not assigned yet.</span></td></tr>`;

  const packing = sheet.packingLocation
    ? placeValue(sheet.packingLocation)
    : `<span class="place-chip missing"><span class="place-name">غير مطلوب</span><span class="en-inline">Not required</span></span>`;

  const packingSteps = sheet.packingLocation
    ? `<div class="pack-help">
        <span class="pack-art">${icon('package')}</span>
        <div>
          <div class="pack-title">تعليمات التعبئة<span>Packing Instructions</span></div>
          <ol>
            <li><span>1</span><div>استخدم مواد التغليف المناسبة للمنتجات.<em>Use appropriate packaging materials.</em></div></li>
            <li><span>2</span><div>تأكد من سلامة المنتجات وجودة التغليف.<em>Ensure items are in good condition and properly packed.</em></div></li>
            <li><span>3</span><div>أثبت ملصق الطلب على العبوة.<em>Attach the order label to the package.</em></div></li>
          </ol>
        </div>
      </div>`
    : '';

  return `<section class="sheet">
    <header class="mast">
      <div class="brand">
        ${logoDataUri ? `<img class="logo" src="${logoDataUri}" alt="EMDAD" />` : ''}
        <div>
          <div class="brand-name">EMDAD Logistics &amp; Warehousing</div>
          <div class="brand-sub">Logistics &amp; Warehousing</div>
        </div>
      </div>
      <div class="doc-title">
        <h1>تعليمات التنفيذ</h1>
        <p>Operational Instructions</p>
      </div>
    </header>

    <section class="info">
      <div class="info-col">
        <span class="info-ico">${icon('file')}</span>
        <div>
          <div class="kicker">رقم الطلب<span>OMS Order No.</span></div>
          <div class="order-no">${esc(sheet.orderNumber || '—')}</div>
        </div>
      </div>
      <div class="info-col stack">
        <div class="info-line">
          <span class="info-ico">${icon('user')}</span>
          <div>
            <div class="kicker">العميل<span>Client</span></div>
            <div class="value">${esc(sheet.clientName || '—')}</div>
          </div>
        </div>
        <div class="info-line">
          <span class="info-ico">${icon('user')}</span>
          <div>
            <div class="kicker">المرسل / المسؤول<span>Operator</span></div>
            <div class="value">${esc(sheet.operatorName || '—')}</div>
          </div>
        </div>
      </div>
      <div class="info-col">
        <span class="info-ico">${icon('calendar')}</span>
        <div>
          <div class="kicker">تاريخ الطلب<span>Order Date</span></div>
          <div class="value date">${esc(sheet.orderDate || '—')}</div>
        </div>
      </div>
    </section>

    <section class="stage stage-flow">
      <div class="stage-head">
        <div class="stage-main">
          <span class="step">1</span>
          <span class="stage-ico stage-ico-lg">${icon('cart')}</span>
          <div class="stage-copy">
            <h2>الالتقاط <span>(Picking)</span></h2>
            <p>Pick the products from the specified locations</p>
          </div>
        </div>
        <div class="stage-hint">
          ابدأ الالتقاط من الأماكن الموضحة أدناه.
          <span>Pick the listed products and quantities from the locations below.</span>
        </div>
      </div>
      <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="idx">#</th>
            <th class="col-sku">SKU</th>
            <th class="col-product">المنتج<span>Product</span></th>
            <th class="col-qty">الكمية<span>Quantity</span></th>
            <th class="col-loc">مكان الالتقاط<span>Picking Location</span></th>
            <th class="col-notes">ملاحظات<span>Notes</span></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      </div>
      ${sheet.pickNote ? `<p class="pick-note">${esc(sheet.pickNote)}</p>` : ''}
    </section>

    <section class="stage stage-keep">
      <div class="stage-head">
        <div class="stage-main">
          <span class="step">2</span>
          <span class="stage-ico">${icon('box')}</span>
          <div class="stage-copy">
            <h2>التعبئة <span>(Packing)</span></h2>
            <p>Pack the items at the specified packing location</p>
          </div>
        </div>
        <div class="stage-hint">
          بعد الانتهاء من الالتقاط، توجه إلى مكان التعبئة لتغليف المنتجات.
          <span>After picking is complete, go to the packing location to pack the items.</span>
        </div>
      </div>
      <div class="loc-row">
        <div class="loc-label">${icon('pin')}<div>مكان التعبئة<span>Packing Location</span></div></div>
        ${packing}
      </div>
      ${packingSteps}
    </section>

    <section class="stage stage-keep">
      <div class="stage-head">
        <div class="stage-main">
          <span class="step">3</span>
          <span class="stage-ico">${icon('truck')}</span>
          <div class="stage-copy">
            <h2>الإرسال <span>(Dispatch)</span></h2>
            <p>Move the packed order to the dispatch location</p>
          </div>
        </div>
        <div class="stage-hint">
          بعد الانتهاء من التعبئة، انقل الطلب إلى مكان الإرسال.
          <span>After packing is complete, move the order to the dispatch location.</span>
        </div>
      </div>
      <div class="loc-row">
        <div class="loc-label">${icon('pin')}<div>مكان الإرسال<span>Dispatch Location</span></div></div>
        ${placeValue(sheet.dispatchLocation)}
      </div>
    </section>
    <footer class="foot">
      <div class="foot-brand">
        ${logoDataUri ? `<img class="logo" src="${logoDataUri}" alt="" />` : ''}
        <div>
          <div class="foot-name">EMDAD Logistics &amp; Warehousing</div>
          <div class="foot-sub">Logistics &amp; Warehousing</div>
        </div>
      </div>
      <div class="foot-slogan">
        <strong>حلول لوجستية أكثر كفاءة</strong>
        <span>More Efficient Logistics Solutions</span>
      </div>
    </footer>
  </section>`;
}

export function renderInstructionSheetsHtml(sheets: InstructionSheet[]): string {
  return `<!DOCTYPE html>
<html lang="ar">
<head>
  <meta charset="utf-8" />
  <title>تعليمات التنفيذ</title>
  <style>
    ${fontFace}
    @page { size: A4; margin: 12mm 14mm 16mm 14mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      color: #1c2b24;
      font-family: Cairo, Tahoma, "Segoe UI", sans-serif;
      font-size: 13px;
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet { break-before: page; page-break-before: always; }
    .sheet:first-child { break-before: auto; page-break-before: auto; }
    .mast {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 0 0 10px;
      margin: 0 0 12px;
      border-bottom: 2px solid #0b5e3c;
    }
    .brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .logo { height: 48px; width: auto; display: block; }
    .brand-name { color: #0b5e3c; font-size: 16px; font-weight: 800; line-height: 1.15; }
    .brand-sub { margin-top: 2px; color: #6d8276; font-size: 11px; }
    .doc-title { text-align: right; }
    .doc-title h1 { margin: 0; color: #0b5e3c; font-size: 28px; font-weight: 800; line-height: 1.05; }
    .doc-title p { margin: 2px 0 0; color: #6d8276; font-size: 13px; }
    .info {
      display: flex;
      align-items: stretch;
      margin: 0 0 12px;
      border: none;
      border-radius: 14px;
      background: #eaf6f0;
      overflow: hidden;
    }
    .info-col {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
    }
    .info-col + .info-col { border-left: 1px solid #d3ebdf; }
    .info-col.stack { flex-direction: column; align-items: stretch; gap: 8px; }
    .info-line { display: flex; align-items: center; gap: 10px; }
    .info-ico, .stage-ico {
      width: 36px;
      height: 36px;
      flex: 0 0 36px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
      background: #eaf6f0;
      color: #0b5e3c;
    }
    .stage-ico { background: #eaf6f0; }
    .stage-ico-lg { width: 46px; height: 46px; flex-basis: 46px; border-radius: 12px; }
    .stage-ico-lg .ico { width: 28px; height: 28px; }
    .ico { width: 22px; height: 22px; display: block; }
    .kicker { color: #5e7368; font-size: 12px; font-weight: 700; line-height: 1.2; }
    .kicker span, .stage-hint span, .loc-label span, .pack-title span, th span, td.empty span {
      display: block;
      margin-top: 1px;
      color: #7d9086;
      font-size: 10.5px;
      font-weight: 600;
      line-height: 1.25;
    }
    .info-col:first-child { flex: 1.15; }
    .order-no { margin-top: 2px; color: #0b5e3c; font-size: 17px; font-weight: 800; letter-spacing: 0.1px; line-height: 1.15; white-space: nowrap; }
    .value { margin-top: 1px; color: #163028; font-size: 15px; font-weight: 800; line-height: 1.2; }
    .value.date { color: #0b5e3c; font-size: 16px; }
    .stage {
      margin: 0 0 12px;
      border: 1.5px solid #c5ddd2;
      border-radius: 14px;
      background: #fff;
    }
    .stage-keep, .stage-flow { overflow: visible; break-inside: auto; page-break-inside: auto; }
    .stage-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 12px;
      background: #fff;
    }
    .stage-main { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .step {
      width: 40px;
      height: 40px;
      flex: 0 0 40px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 11px;
      background: #0b5e3c;
      color: #fff;
      font-size: 20px;
      font-weight: 800;
    }
    .stage-copy h2 { margin: 0; color: #0b5e3c; font-size: 18px; font-weight: 800; line-height: 1.15; }
    .stage-copy h2 span { font-weight: 700; }
    .stage-copy p { margin: 2px 0 0; color: #6d8276; font-size: 11px; line-height: 1.25; }
    .stage-hint {
      flex: 0 1 240px;
      padding: 8px 10px;
      border-radius: 10px;
      background: #eaf6f0;
      border: none;
      color: #245443;
      font-size: 12px;
      font-weight: 700;
      line-height: 1.35;
      text-align: right;
    }
    .table-wrap { padding: 0 12px 12px; }
    table { width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid #c5ddd2; border-radius: 10px; overflow: hidden; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    th, td {
      padding: 7px 8px;
      text-align: left;
      vertical-align: middle;
      border-right: 1px solid #d7e6de;
      border-bottom: 1px solid #d7e6de;
      font-size: 13px;
      line-height: 1.3;
      background: #fff;
    }
    th:last-child, td:last-child { border-right: none; }
    tr:last-child td { border-bottom: none; }
    th {
      background: #d7efe4;
      color: #1d4d36;
      font-size: 12.5px;
      font-weight: 800;
      line-height: 1.2;
      border-bottom: 1px solid #c5ddd2;
    }
    th span { font-weight: 600; }
    th.idx, td.idx { width: 32px; color: #5e7368; font-weight: 700; text-align: center; }
    th.col-sku, td.sku { width: 18%; }
    th.col-qty, td.qty { width: 11%; }
    th.col-loc, td.loc { width: 27%; }
    th.col-notes, td.notes { width: 11%; }
    td.sku { font-family: "Segoe UI", Tahoma, sans-serif; color: #245443; font-weight: 700; font-size: 12px; }
    td.product { font-weight: 800; color: #163028; font-size: 13.5px; }
    td.qty { color: #0b5e3c; font-size: 16px; font-weight: 800; text-align: center; }
    td.notes { color: #8aa093; text-align: center; }
    td.empty { text-align: center; color: #5e7368; padding: 12px; }
    .loc-name { display: block; font-weight: 800; color: #163028; font-size: 13.5px; line-height: 1.25; }
    .code {
      display: inline-block;
      margin-top: 3px;
      padding: 1px 7px;
      border-radius: 999px;
      background: #f4f7f5;
      border: 1px solid #d5dfda;
      color: #4d655a;
      font-size: 10.5px;
      font-weight: 700;
      line-height: 1.3;
    }
    .pick-note { margin: 0 12px 10px; color: #8a5a12; font-size: 12px; font-weight: 700; line-height: 1.35; }
    .loc-row {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 14px;
      margin: 2px 12px 10px;
      padding: 12px 16px;
      border: none;
      border-radius: 12px;
      background: #e7f6ee;
    }
    .loc-label { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; color: #0b5e3c; font-size: 16px; font-weight: 800; line-height: 1.15; }
    .loc-label .ico { width: 26px; height: 26px; }
    .place-chip {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 8px;
      min-width: 0;
      padding: 0;
      border: none;
      background: transparent;
    }
    .place-name { color: #0b5e3c; font-size: 20px; font-weight: 800; line-height: 1.15; }
    .place-chip .code { margin-top: 0; background: #fff; font-size: 12px; }
    .place-chip.missing { gap: 2px; }
    .en-inline { color: #7d9086; font-size: 11px; font-weight: 700; }
    .pack-help {
      display: flex;
      align-items: center;
      gap: 14px;
      margin: 0 12px 12px;
      padding: 10px 12px;
      border-radius: 12px;
      background: #f7fbf8;
      border: 1px solid #e3f0e8;
    }
    .pack-art {
      width: 64px;
      height: 64px;
      flex: 0 0 64px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #0b5e3c;
    }
    .pack-art .ico { width: 52px; height: 52px; }
    .pack-title { color: #0b5e3c; font-size: 15px; font-weight: 800; line-height: 1.2; }
    ol { list-style: none; margin: 6px 0 0; padding: 0; }
    ol li {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      margin-top: 4px;
      color: #1c2b24;
      font-size: 12.5px;
      font-weight: 700;
      line-height: 1.35;
    }
    ol li span {
      width: 18px;
      height: 18px;
      flex: 0 0 18px;
      margin-top: 1px;
      border-radius: 999px;
      background: #0b5e3c;
      color: #fff;
      font-size: 10px;
      line-height: 18px;
      text-align: center;
    }
    ol li em { display: block; margin-top: 1px; color: #6d8276; font-style: normal; font-size: 11px; font-weight: 600; line-height: 1.3; }
    .foot {
      position: fixed;
      left: 14mm;
      right: 14mm;
      bottom: 4mm;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding-top: 6px;
      border-top: 1px solid #d5e8de;
      background: #fff;
    }
    .foot-brand { display: flex; align-items: center; gap: 8px; }
    .foot .logo { height: 26px; }
    .foot-name { color: #0b5e3c; font-size: 11px; font-weight: 800; line-height: 1.1; }
    .foot-sub { color: #7d9086; font-size: 9px; }
    .foot-slogan { text-align: right; }
    .foot-slogan strong { display: block; color: #0b5e3c; font-size: 12px; }
    .foot-slogan span { color: #7d9086; font-size: 9px; }
    .stage-head, .loc-row, .pack-help, .info { break-inside: avoid; page-break-inside: avoid; }
  </style>
</head>
<body>
${sheets.map(sheetHtml).join('\n')}
</body>
</html>`;
}
