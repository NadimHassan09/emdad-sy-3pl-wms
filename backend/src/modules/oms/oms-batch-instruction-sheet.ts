import type { InstructionPlace } from './oms-instruction-sheet';
import { esc, fontFace, icon, logoDataUri } from './oms-instruction-sheet';
import type { BatchInstructionDocument } from './oms-batch-instruction';

function codeBadge(code: string): string {
  const value = code.trim();
  if (!value) return '';
  return `<span class="code">(${esc(value)})</span>`;
}

function placeValue(place: InstructionPlace): string {
  return `<span class="place-chip"><span class="place-name">${esc(place.name || '—')}</span>${codeBadge(place.code)}</span>`;
}

function placeMissing(): string {
  return `<span class="place-chip missing"><span class="place-name">غير مطلوب</span><span class="en-inline">Not required</span></span>`;
}

const PACKING_STEPS = `<div class="pack-help">
  <div class="pack-head">
    <span class="pack-art">${icon('package')}</span>
    <div class="pack-title">تعليمات التعبئة <span class="pack-title-en">(Packing Instructions)</span></div>
  </div>
  <div class="pack-cols">
    <ol class="pack-en" dir="ltr">
      <li><span>1</span><div>Use appropriate packaging materials.</div></li>
      <li><span>2</span><div>Ensure items are in good condition and properly packed.</div></li>
      <li><span>3</span><div>Attach the order label to the package.</div></li>
    </ol>
    <ol class="pack-ar" dir="rtl">
      <li><span>1</span><div>استخدم مواد التغليف المناسبة للمنتجات.</div></li>
      <li><span>2</span><div>تأكد من سلامة المنتجات وجودة التغليف.</div></li>
      <li><span>3</span><div>أثبت ملصق الطلب على العبوة.</div></li>
    </ol>
  </div>
</div>`;

function locationBars(
  groups: Array<{ place: InstructionPlace | null; orderNumbers: string[] }>,
  labelAr: string,
  labelEn: string,
): string {
  if (groups.length === 0) {
    return `<div class="loc-row"><div class="loc-label">${icon('pin')}<div>${labelAr}<span>${labelEn}</span></div></div><span class="place-chip missing"><span class="place-name">—</span></span></div>`;
  }
  return groups
    .map((group) => {
      const value = group.place ? placeValue(group.place) : placeMissing();
      return `<div class="loc-block">
        <div class="loc-row">
          <div class="loc-label">${icon('pin')}<div>${labelAr}<span>${labelEn}</span></div></div>
          ${value}
        </div>
      </div>`;
    })
    .join('');
}

export function renderBatchInstructionHtml(doc: BatchInstructionDocument): string {
  let rowIndex = 0;
  const pickingBody =
    doc.locations.length === 0
      ? `<tr><td class="empty" colspan="5">لا توجد كميات للالتقاط في طلبات هذه المجموعة.<span>No pick quantities were found for this batch.</span></td></tr>`
      : doc.locations
          .map((location) => {
            const banner = `<tr class="loc-banner"><td colspan="5"><span class="pin">${icon('pin')}</span><span class="loc-name">${esc(location.locationName)}</span> ${codeBadge(location.locationCode)}</td></tr>`;
            const rows = location.rows
              .map((row) => {
                rowIndex += 1;
                return `<tr>
                  <td class="idx">${rowIndex}</td>
                  <td class="sku">${esc(row.sku)}</td>
                  <td class="product">${esc(row.name)}</td>
                  <td class="qty">${esc(row.quantity)}</td>
                  <td class="orders">${row.orderCount}</td>
                </tr>`;
              })
              .join('');
            return banner + rows;
          })
          .join('');

  const allocationBody =
    doc.allocations.length === 0
      ? `<tr><td class="empty" colspan="4">لا يوجد توزيع على الطلبات.<span>No order allocation is available.</span></td></tr>`
      : doc.allocations
          .map(
            (row) => `<tr>
              <td class="sku">${esc(row.sku)}</td>
              <td class="product">${esc(row.name)}</td>
              <td class="qty">${esc(row.total)}</td>
              <td class="split">${row.splits.map((split) => `<span class="pill">${esc(split.orderNumber)} <b>${esc(split.quantity)}</b></span>`).join('')}</td>
            </tr>`,
          )
          .join('');

  const checklistBody = doc.checklist
    .map(
      (row, index) => `<tr>
        <td class="idx">${index + 1}</td>
        <td class="sku">${esc(row.orderNumber)}</td>
        <td>${esc(row.customerName)}</td>
        <td class="qty">${esc(row.itemCount)}</td>
        <td class="check"><span class="box"></span></td>
        <td class="check"><span class="box"></span></td>
        <td class="check"><span class="box"></span></td>
        <td class="notes">${esc(row.note)}</td>
      </tr>`,
    )
    .join('');

  const title = doc.batchName ? `${doc.batchNumber} · ${doc.batchName}` : doc.batchNumber;

  return `<!DOCTYPE html>
<html lang="ar">
<head>
  <meta charset="utf-8" />
  <title>تعليمات المجموعة ${esc(doc.batchNumber)}</title>
  <style>
    ${fontFace}
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
    .sheet { }
    .mast {
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      padding: 0 0 10px; margin: 0 0 12px; border-bottom: 2px solid #0b5e3c;
    }
    .brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .logo { height: 48px; width: auto; display: block; }
    .brand-name { color: #0b5e3c; font-size: 16px; font-weight: 800; line-height: 1.15; }
    .brand-sub { margin-top: 2px; color: #6d8276; font-size: 11px; }
    .doc-title { text-align: right; }
    .doc-title h1 { margin: 0; color: #0b5e3c; font-size: 26px; font-weight: 800; line-height: 1.05; }
    .doc-title p { margin: 2px 0 0; color: #6d8276; font-size: 13px; }
    .info {
      display: flex; align-items: stretch; margin: 0 0 12px; border-radius: 14px; background: #eaf6f0; overflow: hidden;
    }
    .info-col { flex: 1; display: flex; align-items: center; gap: 10px; padding: 10px 14px; }
    .info-col + .info-col { border-left: 1px solid #d3ebdf; }
    .info-ico, .stage-ico {
      width: 36px; height: 36px; flex: 0 0 36px; display: inline-flex; align-items: center; justify-content: center;
      border-radius: 10px; background: #eaf6f0; color: #0b5e3c;
    }
    .stage-ico-lg { width: 46px; height: 46px; flex-basis: 46px; border-radius: 12px; }
    .stage-ico-lg .ico { width: 28px; height: 28px; }
    .ico { width: 22px; height: 22px; display: block; }
    .kicker { color: #5e7368; font-size: 12px; font-weight: 700; line-height: 1.2; }
    .kicker span, .stage-hint span, .loc-label span, th span, td.empty span {
      display: block; margin-top: 1px; color: #7d9086; font-size: 10.5px; font-weight: 600; line-height: 1.25;
    }
    .pack-title-en { display: inline !important; margin: 0 !important; color: #6d8276; font-size: 13px; font-weight: 700; }
    .order-no { margin-top: 2px; color: #0b5e3c; font-size: 17px; font-weight: 800; line-height: 1.15; }
    .value { margin-top: 1px; color: #163028; font-size: 15px; font-weight: 800; line-height: 1.2; }
    .stage { margin: 0 0 12px; border: 1.5px solid #c5ddd2; border-radius: 14px; background: #fff; overflow: visible; }
    /* Compact sections move entirely to the next page instead of starting in the leftover strip. */
    .stage.stage-keep { break-inside: avoid; page-break-inside: avoid; }
    /* Tall tables may continue. Their heading stays with the first rows; only the table header repeats. */
    .stage.stage-flow { break-inside: auto; page-break-inside: auto; }
    .stage-flow > .stage-head { break-inside: avoid; page-break-inside: avoid; break-after: avoid; page-break-after: avoid; }
    .stage-flow > .stage-head::after { content: ""; display: block; height: 280px; margin-bottom: -280px; }
    .stage-flow > .table-wrap,
    .stage-flow > .pick-note { break-before: avoid; page-break-before: avoid; }
    .stage-head {
      display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; background: #fff;
      border-top-left-radius: 12px; border-top-right-radius: 12px;
    }
    .stage-main { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .step {
      width: 40px; height: 40px; flex: 0 0 40px; display: inline-flex; align-items: center; justify-content: center;
      border-radius: 11px; background: #0b5e3c; color: #fff; font-size: 20px; font-weight: 800;
    }
    .stage-copy h2 { margin: 0; color: #0b5e3c; font-size: 18px; font-weight: 800; line-height: 1.15; }
    .stage-copy h2 span { font-weight: 700; }
    .stage-copy p { margin: 2px 0 0; color: #6d8276; font-size: 11px; line-height: 1.25; }
    .stage-hint {
      flex: 0 1 240px; padding: 8px 10px; border-radius: 10px; background: #eaf6f0; color: #245443;
      font-size: 12px; font-weight: 700; line-height: 1.35; text-align: right;
    }
    .table-wrap { padding: 0 12px 12px; }
    table {
      width: 100%; table-layout: fixed; border-collapse: separate; border-spacing: 0; border: 0;
      border-radius: 10px; background: #fff; break-inside: auto; page-break-inside: auto;
    }
    thead { display: table-header-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    th, td {
      padding: 7px 8px; text-align: left; vertical-align: middle; border-right: 1px solid #d7e6de;
      border-bottom: 1px solid #d7e6de; font-size: 12.5px; line-height: 1.3; background: #fff;
    }
    thead tr:first-child th { border-top: 1px solid #c5ddd2; }
    th:first-child, td:first-child { border-left: 1px solid #c5ddd2; }
    th:last-child, td:last-child { border-right: 1px solid #c5ddd2; }
    tbody tr:last-child td { border-bottom: 1px solid #c5ddd2; }
    thead tr:first-child th:first-child { border-top-left-radius: 10px; }
    thead tr:first-child th:last-child { border-top-right-radius: 10px; }
    tbody tr:last-child td:first-child { border-bottom-left-radius: 10px; }
    tbody tr:last-child td:last-child { border-bottom-right-radius: 10px; }
    th { background: #d7efe4; color: #1d4d36; font-size: 12px; font-weight: 800; line-height: 1.2; }
    th.idx, td.idx { width: 32px; color: #5e7368; font-weight: 700; text-align: center; }
    td.sku { font-family: "Segoe UI", Tahoma, sans-serif; color: #245443; font-weight: 700; font-size: 12px; }
    td.product { font-weight: 800; color: #163028; }
    td.qty, td.orders, td.check { color: #0b5e3c; font-size: 15px; font-weight: 800; text-align: center; }
    td.notes { color: #5e7368; text-align: center; }
    td.empty { text-align: center; color: #5e7368; padding: 12px; }
    tr.loc-banner td { background: #eaf6f0; color: #0b5e3c; font-weight: 800; font-size: 13.5px; }
    tr.loc-banner .pin { display: inline-flex; align-items: center; margin-inline-end: 6px; vertical-align: -4px; }
    tr.loc-banner .pin .ico { width: 16px; height: 16px; }
    tr.loc-banner .loc-name { vertical-align: middle; }
    tr.loc-banner .code { margin-top: 0; margin-inline-start: 6px; background: #fff; }
    .code {
      display: inline-block; margin-top: 3px; padding: 1px 7px; border-radius: 999px; background: #f4f7f5;
      border: 1px solid #d5dfda; color: #4d655a; font-size: 10.5px; font-weight: 700; line-height: 1.3;
    }
    .pick-note { margin: 0 12px 10px; color: #8a5a12; font-size: 12px; font-weight: 700; line-height: 1.35; }
    .loc-row {
      display: flex; align-items: center; justify-content: flex-start; gap: 14px;
      margin: 2px 12px 10px; padding: 12px 16px; border-radius: 12px; background: #e7f6ee;
    }
    .loc-label { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; color: #0b5e3c; font-size: 16px; font-weight: 800; line-height: 1.15; }
    .loc-label .ico { width: 26px; height: 26px; }
    .place-chip { display: flex; flex-direction: row; align-items: center; gap: 8px; min-width: 0; }
    .place-name { color: #0b5e3c; font-size: 20px; font-weight: 800; line-height: 1.15; }
    .place-chip .code { margin-top: 0; background: #fff; font-size: 12px; }
    .place-chip.missing { gap: 2px; }
    .en-inline { color: #7d9086; font-size: 11px; font-weight: 700; }
    .pack-help {
      display: flex; flex-direction: column; gap: 10px; margin: 10px 12px 12px; padding: 12px 14px;
      border-radius: 12px; background: #f7fbf8; border: 1px solid #e3f0e8;
    }
    .pack-head { display: flex; align-items: center; gap: 12px; }
    .pack-art { width: 40px; height: 40px; flex: 0 0 40px; display: flex; align-items: center; justify-content: center; color: #0b5e3c; }
    .pack-art .ico { width: 32px; height: 32px; }
    .pack-title { color: #0b5e3c; font-size: 16px; font-weight: 800; line-height: 1.2; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
    .pack-title-en { display: inline !important; margin: 0 !important; color: #6d8276; font-size: 13px; font-weight: 700; }
    .pack-cols { display: flex; gap: 16px; align-items: stretch; }
    .pack-cols ol { flex: 1 1 0; list-style: none; margin: 0; padding: 0; }
    .pack-cols ol li { display: flex; gap: 8px; align-items: flex-start; margin-top: 6px; color: #1c2b24; font-size: 12.5px; font-weight: 700; line-height: 1.35; }
    .pack-cols ol li span {
      width: 18px; height: 18px; flex: 0 0 18px; margin-top: 1px; border-radius: 999px; background: #0b5e3c;
      color: #fff; font-size: 10px; line-height: 18px; text-align: center;
    }
    .pack-en { text-align: left; }
    .pack-ar { text-align: right; }
    .split { line-height: 1.6; }
    .pill { display: inline-block; margin: 2px 4px 2px 0; padding: 1px 7px; border-radius: 999px; background: #eaf6f0; color: #245443; font-size: 11px; font-weight: 700; white-space: nowrap; }
    .pill b { color: #0b5e3c; }
    .box { display: inline-block; width: 14px; height: 14px; border: 1.6px solid #0b5e3c; border-radius: 3px; background: #fff; }
    .mast, .info, .stage-head, .loc-row, .pack-help { break-inside: avoid; page-break-inside: avoid; }
    .stage-keep > .stage-head { break-after: avoid; page-break-after: avoid; }
  </style>
</head>
<body>
<section class="sheet">
  <header class="mast">
    <div class="brand">
      ${logoDataUri ? `<img class="logo" src="${logoDataUri}" alt="EMDAD" />` : ''}
      <div>
        <div class="brand-name">EMDAD Logistics &amp; Warehousing</div>
        <div class="brand-sub">Logistics &amp; Warehousing</div>
      </div>
    </div>
    <div class="doc-title">
      <h1>تعليمات المجموعة</h1>
      <p>Batch Operational Instructions</p>
    </div>
  </header>
  <section class="info">
    <div class="info-col">
      <span class="info-ico">${icon('file')}</span>
      <div>
        <div class="kicker">رقم المجموعة<span>Batch</span></div>
        <div class="order-no">${esc(title)}</div>
      </div>
    </div>
    <div class="info-col">
      <span class="info-ico">${icon('cart')}</span>
      <div>
        <div class="kicker">الطلبات / القطع / الأصناف<span>Orders / Units / SKUs</span></div>
        <div class="value">${doc.orderCount} · ${esc(doc.unitTotal)} · ${doc.uniqueSkuCount}</div>
      </div>
    </div>
    <div class="info-col">
      <span class="info-ico">${icon('user')}</span>
      <div>
        <div class="kicker">تاريخ الإنشاء / بواسطة<span>Created</span></div>
        <div class="value">${esc(doc.createdAtLabel || '—')}</div>
        <div class="kicker">${esc(doc.createdByName || '—')}</div>
      </div>
    </div>
  </section>

  <section class="stage stage-flow">
    <div class="stage-head">
      <div class="stage-main">
        <span class="step">1</span>
        <span class="stage-ico stage-ico-lg">${icon('cart')}</span>
        <div class="stage-copy">
          <h2>التقاط مجمّع <span>(Consolidated Picking)</span></h2>
          <p>Collect the total quantity once from each location</p>
        </div>
      </div>
      <div class="stage-hint">الكمية هي مجموع كل الطلبات في هذه المجموعة لهذا المنتج والمكان.<span>Quantity is the total across every order in this batch for that product and location.</span></div>
    </div>
    <div class="table-wrap">
      <table class="pick-table">
        <colgroup><col style="width:34px" /><col style="width:18%" /><col /><col style="width:15%" /><col style="width:14%" /></colgroup>
        <thead><tr>
          <th class="idx">#</th>
          <th>SKU</th>
          <th>المنتج<span>Product</span></th>
          <th>الكمية الكلية<span>Total Qty</span></th>
          <th>عدد الطلبات<span># Orders</span></th>
        </tr></thead>
        <tbody>${pickingBody}</tbody>
      </table>
    </div>
    ${doc.pickShort ? '<p class="pick-note">بعض الكميات غير متوفرة بالكامل في المخزون المتاح. راجع الأماكن الظاهرة ثم أعد الطباعة بعد التوفر.</p>' : ''}
  </section>

  <section class="stage stage-flow">
    <div class="stage-head">
      <div class="stage-main">
        <span class="step">2</span>
        <span class="stage-ico">${icon('box')}</span>
        <div class="stage-copy">
          <h2>توزيع الطلبات <span>(Order Allocation)</span></h2>
          <p>Split the collected units back to each order</p>
        </div>
      </div>
      <div class="stage-hint">بعد الالتقاط، وزّع الكمية على أرقام الطلبات أثناء التعبئة.<span>After picking, allocate the units to these order numbers while packing.</span></div>
    </div>
    <div class="table-wrap">
      <table class="alloc-table">
        <colgroup><col style="width:16%" /><col style="width:22%" /><col style="width:12%" /><col /></colgroup>
        <thead><tr>
          <th>SKU</th>
          <th>المنتج<span>Product</span></th>
          <th>المجموع<span>Total</span></th>
          <th>الطلب ← الكمية<span>Order → Qty</span></th>
        </tr></thead>
        <tbody>${allocationBody}</tbody>
      </table>
    </div>
  </section>

  <section class="stage stage-keep">
    <div class="stage-head">
      <div class="stage-main">
        <span class="step">3</span>
        <span class="stage-ico">${icon('box')}</span>
        <div class="stage-copy">
          <h2>التعبئة <span>(Packing)</span></h2>
          <p>Pack the items at the specified packing location</p>
        </div>
      </div>
      <div class="stage-hint">بعد الانتهاء من الالتقاط، توجه إلى مكان التعبئة لتغليف المنتجات.<span>After picking is complete, go to the packing location to pack the items.</span></div>
    </div>
    ${locationBars(doc.packingGroups, 'مكان التعبئة', 'Packing Location')}
    ${doc.packingGroups.some((group) => group.place) ? PACKING_STEPS : ''}
  </section>

  <section class="stage stage-keep">
    <div class="stage-head">
      <div class="stage-main">
        <span class="step">4</span>
        <span class="stage-ico">${icon('truck')}</span>
        <div class="stage-copy">
          <h2>الإرسال <span>(Dispatch)</span></h2>
          <p>Move the packed orders to the dispatch location</p>
        </div>
      </div>
      <div class="stage-hint">بعد الانتهاء من التعبئة، انقل الطلبات إلى مكان الإرسال.<span>After packing is complete, move the orders to the dispatch location.</span></div>
    </div>
    ${locationBars(doc.dispatchGroups, 'مكان الإرسال', 'Dispatch Location')}
  </section>

  <section class="stage stage-flow">
    <div class="stage-head">
      <div class="stage-main">
        <span class="step">5</span>
        <span class="stage-ico">${icon('file')}</span>
        <div class="stage-copy">
          <h2>قائمة التحقق <span>(Order Checklist)</span></h2>
          <p>Mark each order after picking, packing, and dispatch</p>
        </div>
      </div>
    </div>
    <div class="table-wrap">
      <table class="check-table">
        <colgroup><col style="width:32px" /><col style="width:20%" /><col /><col style="width:8%" /><col style="width:9%" /><col style="width:9%" /><col style="width:9%" /><col style="width:11%" /></colgroup>
        <thead><tr>
          <th class="idx">#</th>
          <th>رقم الطلب<span>Order</span></th>
          <th>العميل<span>Customer</span></th>
          <th>القطع<span>Items</span></th>
          <th>التقاط<span>Picking</span></th>
          <th>تعبئة<span>Packing</span></th>
          <th>إرسال<span>Dispatch</span></th>
          <th>ملاحظات<span>Notes</span></th>
        </tr></thead>
        <tbody>${checklistBody}</tbody>
      </table>
    </div>
  </section>
</section>
</body>
</html>`;
}

/** Printed in Chromium's page margin so table rows stay above it on every page. */
export function batchInstructionFooterTemplate(): string {
  const logo = logoDataUri
    ? `<img src="${logoDataUri}" style="height:20px;width:auto;display:block;" />`
    : '';
  return `<style>${fontFace}</style>
<div style="width:100%;height:14mm;overflow:hidden;box-sizing:border-box;padding:1mm 14mm 0;font-family:Cairo,Tahoma,sans-serif;-webkit-print-color-adjust:exact;">
  <div style="border-top:1px solid #d5e8de;padding-top:4px;display:flex;justify-content:space-between;align-items:center;gap:12px;">
    <div style="display:flex;align-items:center;gap:8px;">
      ${logo}
      <div>
        <div style="color:#0b5e3c;font-size:10px;font-weight:800;line-height:1.1;">EMDAD Logistics &amp; Warehousing</div>
        <div style="color:#7d9086;font-size:8px;">Logistics &amp; Warehousing</div>
      </div>
    </div>
    <div style="text-align:right;">
      <div style="color:#0b5e3c;font-size:11px;font-weight:800;line-height:1.15;">حلول لوجستية أكثر كفاءة</div>
      <div style="color:#7d9086;font-size:8px;">More Efficient Logistics Solutions</div>
    </div>
  </div>
</div>`;
}

export type BatchInstructionKind = 'full' | 'picking' | 'packing';

function sharedStyles(): string {
  return `    ${fontFace}
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
    .sheet { }
    .mast {
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      padding: 0 0 10px; margin: 0 0 12px; border-bottom: 2px solid #0b5e3c;
    }
    .brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .logo { height: 48px; width: auto; display: block; }
    .brand-name { color: #0b5e3c; font-size: 16px; font-weight: 800; line-height: 1.15; }
    .brand-sub { margin-top: 2px; color: #6d8276; font-size: 11px; }
    .doc-title { text-align: right; }
    .doc-title h1 { margin: 0; color: #0b5e3c; font-size: 26px; font-weight: 800; line-height: 1.05; }
    .doc-title p { margin: 2px 0 0; color: #6d8276; font-size: 13px; }
    .info {
      display: flex; align-items: stretch; margin: 0 0 12px; border-radius: 14px; background: #eaf6f0; overflow: hidden;
    }
    .info-col { flex: 1; display: flex; align-items: center; gap: 10px; padding: 10px 14px; }
    .info-col + .info-col { border-left: 1px solid #d3ebdf; }
    .info-ico { width: 36px; height: 36px; flex: 0 0 36px; display: inline-flex; align-items: center; justify-content: center; border-radius: 10px; background: #eaf6f0; color: #0b5e3c; }
    .ico { width: 22px; height: 22px; display: block; }
    .kicker { color: #5e7368; font-size: 12px; font-weight: 700; line-height: 1.2; }
    .kicker span, .stage-hint span, .loc-label span, th span, td.empty span {
      display: block; margin-top: 1px; color: #7d9086; font-size: 10.5px; font-weight: 600; line-height: 1.25;
    }
    .order-no { margin-top: 2px; color: #0b5e3c; font-size: 17px; font-weight: 800; line-height: 1.15; }
    .value { margin-top: 1px; color: #163028; font-size: 15px; font-weight: 800; line-height: 1.2; }
    .stage { margin: 0 0 12px; border: 1.5px solid #c5ddd2; border-radius: 14px; background: #fff; overflow: visible; }
    .stage.stage-keep { break-inside: avoid; page-break-inside: avoid; }
    .stage.stage-flow { break-inside: auto; page-break-inside: auto; }
    .stage-head {
      display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; background: #fff;
      border-top-left-radius: 12px; border-top-right-radius: 12px;
    }
    .stage-main { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .step {
      width: 40px; height: 40px; flex: 0 0 40px; display: inline-flex; align-items: center; justify-content: center;
      border-radius: 11px; background: #0b5e3c; color: #fff; font-size: 20px; font-weight: 800;
    }
    .stage-copy h2 { margin: 0; color: #0b5e3c; font-size: 18px; font-weight: 800; line-height: 1.15; }
    .stage-copy p { margin: 2px 0 0; color: #6d8276; font-size: 11px; line-height: 1.25; }
    .stage-hint {
      flex: 0 1 240px; padding: 8px 10px; border-radius: 10px; background: #eaf6f0; color: #245443;
      font-size: 12px; font-weight: 700; line-height: 1.35; text-align: right;
    }
    .table-wrap { padding: 0 12px 12px; }
    table {
      width: 100%; table-layout: fixed; border-collapse: separate; border-spacing: 0;
      border-radius: 10px; background: #fff;
    }
    thead { display: table-header-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    th, td {
      padding: 7px 8px; text-align: left; vertical-align: middle; border-right: 1px solid #d7e6de;
      border-bottom: 1px solid #d7e6de; font-size: 12.5px; line-height: 1.3; background: #fff;
    }
    thead tr:first-child th { border-top: 1px solid #c5ddd2; }
    th:first-child, td:first-child { border-left: 1px solid #c5ddd2; }
    th:last-child, td:last-child { border-right: 1px solid #c5ddd2; }
    tbody tr:last-child td { border-bottom: 1px solid #c5ddd2; }
    th { background: #d7efe4; color: #1d4d36; font-size: 12px; font-weight: 800; line-height: 1.2; }
    th.idx, td.idx { width: 32px; color: #5e7368; font-weight: 700; text-align: center; }
    td.sku { font-family: "Segoe UI", Tahoma, sans-serif; color: #245443; font-weight: 700; font-size: 12px; }
    td.product { font-weight: 800; color: #163028; }
    td.qty, td.orders, td.check { color: #0b5e3c; font-size: 15px; font-weight: 800; text-align: center; }
    td.empty { text-align: center; color: #5e7368; padding: 12px; }
    tr.loc-banner td { background: #eaf6f0; color: #0b5e3c; font-weight: 800; font-size: 13.5px; }
    .code {
      display: inline-block; margin-top: 3px; padding: 1px 7px; border-radius: 999px; background: #f4f7f5;
      border: 1px solid #d5dfda; color: #4d655a; font-size: 10.5px; font-weight: 700;
    }
    .pick-note { margin: 0 12px 10px; color: #8a5a12; font-size: 12px; font-weight: 700; }
    .loc-row {
      display: flex; align-items: center; gap: 14px;
      margin: 2px 12px 10px; padding: 12px 16px; border-radius: 12px; background: #e7f6ee;
    }
    .loc-label { display: flex; align-items: center; gap: 8px; color: #0b5e3c; font-size: 16px; font-weight: 800; }
    .place-chip { display: flex; flex-direction: row; align-items: center; gap: 8px; }
    .place-name { color: #0b5e3c; font-size: 20px; font-weight: 800; }
    .box { display: inline-block; width: 14px; height: 14px; border: 1.6px solid #0b5e3c; border-radius: 3px; background: #fff; }
    .pill { display: inline-block; margin: 2px 4px 2px 0; padding: 1px 7px; border-radius: 999px; background: #eaf6f0; color: #245443; font-size: 11px; font-weight: 700; }
    .order-block { margin: 0 12px 14px; padding: 10px 12px; border: 1px solid #d7e6de; border-radius: 12px; }
    .order-block h3 { margin: 0 0 6px; color: #0b5e3c; font-size: 15px; font-weight: 800; }
    .order-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 8px; color: #245443; font-size: 13px; font-weight: 700; }
    .order-meta .phone { direction: ltr; unicode-bidi: embed; font-family: "Segoe UI", Tahoma, sans-serif; }
    .company-banner {
      margin: 14px 12px 6px; padding: 8px 12px; border-radius: 10px; background: #eaf6f0;
      color: #0b5e3c; font-size: 14px; font-weight: 800;
    }
    .pack-help {
      display: flex; flex-direction: column; gap: 10px; margin: 10px 12px 12px; padding: 12px 14px;
      border-radius: 12px; background: #f7fbf8; border: 1px solid #e3f0e8;
    }
    .pack-head { display: flex; align-items: center; gap: 12px; }
    .pack-art { width: 40px; height: 40px; flex: 0 0 40px; display: flex; align-items: center; justify-content: center; color: #0b5e3c; }
    .pack-art .ico { width: 32px; height: 32px; }
    .pack-title { color: #0b5e3c; font-size: 16px; font-weight: 800; line-height: 1.2; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
    .pack-title-en { display: inline !important; margin: 0 !important; color: #6d8276; font-size: 13px; font-weight: 700; }
    .pack-cols { display: flex; gap: 16px; align-items: stretch; }
    .pack-cols ol { flex: 1 1 0; list-style: none; margin: 0; padding: 0; }
    .pack-cols ol li { display: flex; gap: 8px; align-items: flex-start; margin-top: 6px; color: #1c2b24; font-size: 12.5px; font-weight: 700; line-height: 1.35; }
    .pack-cols ol li span {
      width: 18px; height: 18px; flex: 0 0 18px; margin-top: 1px; border-radius: 999px; background: #0b5e3c;
      color: #fff; font-size: 10px; line-height: 18px; text-align: center;
    }
    .pack-en { text-align: left; }
    .pack-ar { text-align: right; }
`;
}

function mastHeader(doc: BatchInstructionDocument, titleAr: string, titleEn: string): string {
  const title = doc.batchName ? `${doc.batchNumber} · ${doc.batchName}` : doc.batchNumber;
  return `<header class="mast">
    <div class="brand">
      ${logoDataUri ? `<img class="logo" src="${logoDataUri}" alt="EMDAD" />` : ''}
      <div>
        <div class="brand-name">EMDAD Logistics &amp; Warehousing</div>
        <div class="brand-sub">Logistics &amp; Warehousing</div>
      </div>
    </div>
    <div class="doc-title">
      <h1>${titleAr}</h1>
      <p>${titleEn}</p>
    </div>
  </header>
  <section class="info">
    <div class="info-col">
      <span class="info-ico">${icon('file')}</span>
      <div>
        <div class="kicker">رقم المجموعة<span>Batch</span></div>
        <div class="order-no">${esc(title)}</div>
      </div>
    </div>
    <div class="info-col">
      <span class="info-ico">${icon('cart')}</span>
      <div>
        <div class="kicker">الطلبات / القطع / الأصناف<span>Orders / Units / SKUs</span></div>
        <div class="value">${doc.orderCount} · ${esc(doc.unitTotal)} · ${doc.uniqueSkuCount}</div>
      </div>
    </div>
    <div class="info-col">
      <span class="info-ico">${icon('user')}</span>
      <div>
        <div class="kicker">تاريخ الإنشاء / بواسطة<span>Created</span></div>
        <div class="value">${esc(doc.createdAtLabel || '—')}</div>
        <div class="kicker">${esc(doc.createdByName || '—')}</div>
      </div>
    </div>
  </section>`;
}

/** Infer a display group (e.g. colour) from product name for picker readability. */
function pickGroupLabel(name: string): string {
  const n = name.trim();
  const rules: Array<[RegExp, string]> = [
    [/black|أسود|الاسود/i, 'اللون الأسود'],
    [/grey|gray|رمادي|الرمادي/i, 'اللون الرمادي'],
    [/navy|كحلي|الكحلي/i, 'اللون الكحلي'],
    [/olive|زيتي|الزيتي/i, 'اللون الزيتي'],
    [/white|أبيض|الابيض/i, 'اللون الأبيض'],
    [/red|أحمر|الاحمر/i, 'اللون الأحمر'],
    [/blue|أزرق|الازرق/i, 'اللون الأزرق'],
    [/green|أخضر|الاخضر/i, 'اللون الأخضر'],
    [/beige|بيج/i, 'اللون البيج'],
  ];
  for (const [re, label] of rules) {
    if (re.test(n)) return label;
  }
  return 'أصناف أخرى';
}

/** Picking List: one section per order (separate from packing list). */
export function renderBatchPickingListHtml(doc: BatchInstructionDocument): string {
  const title = doc.batchName ? `${doc.batchNumber} · ${doc.batchName}` : doc.batchNumber;
  const orders = doc.orderPicks?.length
    ? doc.orderPicks
    : // Fallback for older callers that only built locations/allocations
      (() => {
        const byOrder = new Map<
          string,
          Array<{ sku: string; name: string; quantity: string; location: string }>
        >();
        for (const alloc of doc.allocations) {
          for (const split of alloc.splits) {
            const rows = byOrder.get(split.orderNumber) ?? [];
            rows.push({ sku: alloc.sku, name: alloc.name, quantity: split.quantity, location: '—' });
            byOrder.set(split.orderNumber, rows);
          }
        }
        const meta = new Map(doc.checklist.map((c) => [c.orderNumber, c]));
        return [...byOrder.entries()].map(([orderNumber, lines]) => {
          const m = meta.get(orderNumber);
          return {
            orderNumber,
            customerName: m?.customerName || '—',
            customerPhone: m?.customerPhone || '—',
            companyName: m?.companyName || '—',
            note: m?.note || '—',
            lines,
          };
        });
      })();

  let grandTotal = 0;
  let orderBlocks = '';
  if (orders.length === 0) {
    orderBlocks = `<p style="color:#5e7368;font-size:13px;padding:12px 0;">لا توجد كميات للالتقاط في هذه المجموعة.</p>`;
  } else {
    orders.forEach((order, oi) => {
      const orderQty = order.lines.reduce(
        (s, l) => s + (Number(String(l.quantity).replace(/,/g, '')) || 0),
        0,
      );
      grandTotal += orderQty;

      const groups = new Map<string, typeof order.lines>();
      for (const line of order.lines) {
        const g = pickGroupLabel(line.name);
        const rows = groups.get(g) ?? [];
        rows.push(line);
        groups.set(g, rows);
      }

      let body = '';
      let idx = 0;
      for (const [groupName, lines] of groups) {
        if (groups.size > 1) {
          body += `<tr class="group-row"><td colspan="4">${esc(groupName)}</td></tr>`;
        }
        for (const line of lines) {
          idx += 1;
          body += `<tr>
            <td class="sku-col">${esc(line.sku)}</td>
            <td class="product">${esc(line.name)}<div class="loc-hint">${esc(line.location)}</div></td>
            <td class="qty">${esc(line.quantity)}</td>
            <td class="check"><span class="box"></span></td>
          </tr>`;
        }
      }

      orderBlocks += `<div class="order-card">
        <div class="order-card-head">
          <div class="order-num">${oi + 1}. ${esc(order.orderNumber)}</div>
          <div class="order-meta-row">
            <span class="order-company">${esc(order.companyName)}</span>
            <span class="order-customer">${esc(order.customerName)}</span>
            ${order.customerPhone && order.customerPhone !== '—' ? `<span class="order-phone">${esc(order.customerPhone)}</span>` : ''}
            <span class="order-items">${orderQty} قطعة</span>
          </div>
        </div>
        <table class="pick-tbl">
          <thead><tr>
            <th style="width:110px">الصنف<span>SKU</span></th>
            <th>المنتج واللون<span>Product</span></th>
            <th style="width:70px;text-align:center;">العدد الإجمالي<span>Qty</span></th>
            <th style="width:44px;text-align:center;">✓</th>
          </tr></thead>
          <tbody>${body}</tbody>
          <tfoot><tr class="order-total-row">
            <td colspan="2">إجمالي الطلب</td>
            <td class="qty">${orderQty}</td>
            <td></td>
          </tr></tfoot>
        </table>
      </div>`;
    });
  }

  return `<!DOCTYPE html>
<html lang="ar"><head><meta charset="utf-8" /><title>قائمة التجميع ${esc(doc.batchNumber)}</title>
<style>${sharedStyles()}
  .simple-header { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; padding:0 0 12px; margin:0 0 14px; border-bottom:3px solid #1e3a5f; }
  .simple-brand { display:flex; align-items:center; gap:10px; }
  .simple-brand .logo { height:52px; width:auto; display:block; }
  .brand-block .brand-name { color:#1e3a5f; font-size:17px; font-weight:800; line-height:1.15; }
  .brand-block .brand-sub { color:#6b7c93; font-size:11px; margin-top:1px; }
  .doc-info { text-align:right; }
  .doc-info h1 { margin:0; color:#1e3a5f; font-size:26px; font-weight:800; line-height:1.05; }
  .doc-info .doc-en { color:#6b7c93; font-size:14px; margin-top:2px; }
  .meta-bar { display:flex; gap:0; margin:0 0 14px; border:1.5px solid #c5d0e0; border-radius:12px; overflow:hidden; background:#eef3fa; }
  .meta-cell { flex:1; padding:9px 14px; border-left:1px solid #c5d0e0; }
  .meta-cell:first-child { border-left:none; }
  .meta-label { color:#5e6d82; font-size:11px; font-weight:700; line-height:1.2; }
  .meta-label span { display:block; color:#8a97ab; font-size:10px; }
  .meta-val { color:#1e3a5f; font-size:15px; font-weight:800; margin-top:2px; line-height:1.2; }
  .order-card { margin:0 0 16px; border:1.5px solid #c5d0e0; border-radius:12px; overflow:hidden; break-inside:avoid; page-break-inside:avoid; page-break-after:auto; }
  .order-card-head { padding:10px 14px; background:#e8eef8; border-bottom:1px solid #c5d0e0; }
  .order-num { color:#1e3a5f; font-size:16px; font-weight:800; }
  .order-meta-row { display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin-top:4px; }
  .order-company { color:#1e3a5f; font-size:13px; font-weight:800; }
  .order-customer { color:#163028; font-size:13px; font-weight:700; }
  .order-phone { color:#5e6d82; font-size:12px; direction:ltr; font-family:"Segoe UI",Tahoma,sans-serif; }
  .order-items { color:#1e3a5f; font-size:12px; font-weight:800; background:#d6e2f5; padding:1px 8px; border-radius:999px; }
  .pick-tbl { width:100%; border-collapse:collapse; }
  .pick-tbl th { background:#1e3a5f; color:#fff; font-size:11.5px; font-weight:800; padding:8px 10px; text-align:right; }
  .pick-tbl th span { display:block; color:#b8c7de; font-size:10px; font-weight:600; }
  .pick-tbl td { padding:7px 10px; font-size:12.5px; border-bottom:1px solid #e6ecf5; vertical-align:middle; background:#fff; }
  .pick-tbl tr:nth-child(even) td { background:#f5f8fc; }
  .pick-tbl td.sku-col { color:#1e3a5f; font-weight:800; font-family:"Segoe UI",Tahoma,sans-serif; font-size:12px; width:110px; }
  .pick-tbl td.product { font-weight:700; color:#163028; }
  .pick-tbl td.qty { text-align:center; color:#1e3a5f; font-size:15px; font-weight:900; width:70px; }
  .pick-tbl td.check { text-align:center; width:44px; }
  .group-row td { background:#4a6fa5 !important; color:#fff; font-weight:800; font-size:12px; padding:6px 10px; }
  .order-total-row td { background:#e8eef8; font-weight:800; color:#1e3a5f; border-top:1.5px solid #c5d0e0; }
  .order-total-row td.qty { font-size:16px; }
  .loc-hint { color:#5e6d82; font-size:10.5px; font-weight:600; margin-top:2px; }
  .box { display:inline-block; width:14px; height:14px; border:1.6px solid #1e3a5f; border-radius:3px; background:#fff; }
  .short-warn { margin:0 0 10px; padding:9px 14px; background:#fffbeb; border:1.5px solid #f5c842; border-radius:10px; color:#8a5a12; font-size:12.5px; font-weight:700; }
  .grand-bar { margin-top:8px; padding:10px 14px; background:#1e3a5f; color:#fff; border-radius:10px; display:flex; justify-content:space-between; font-weight:800; font-size:14px; }
  .sig-row { display:flex; gap:24px; margin-top:18px; }
  .sig-box { flex:1; border-top:1.5px solid #1e3a5f; padding-top:6px; }
  .sig-box .sig-label { color:#1e3a5f; font-size:12px; font-weight:800; }
  .sig-box .sig-label span { display:block; color:#8a97ab; font-size:10px; margin-top:1px; }
</style></head><body style="padding:14mm 14mm 10mm;"><section class="sheet">

<div class="simple-header">
  <div class="simple-brand">
    ${logoDataUri ? `<img class="logo" src="${logoDataUri}" alt="EMDAD" />` : ''}
    <div class="brand-block">
      <div class="brand-name">EMDAD Logistics</div>
      <div class="brand-sub">Logistics &amp; Warehousing</div>
    </div>
  </div>
  <div class="doc-info">
    <h1>قائمة التجميع</h1>
    <div class="doc-en">Picking List</div>
  </div>
</div>

<div class="meta-bar">
  <div class="meta-cell">
    <div class="meta-label">رقم المجموعة<span>Batch</span></div>
    <div class="meta-val">${esc(title)}</div>
  </div>
  <div class="meta-cell">
    <div class="meta-label">التاريخ<span>Date</span></div>
    <div class="meta-val">${esc(doc.createdAtLabel || '—')}</div>
  </div>
  <div class="meta-cell">
    <div class="meta-label">الطلبات / القطع<span>Orders / Units</span></div>
    <div class="meta-val">${orders.length || doc.orderCount} · ${esc(doc.unitTotal)}</div>
  </div>
  <div class="meta-cell">
    <div class="meta-label">بواسطة<span>Created by</span></div>
    <div class="meta-val">${esc(doc.createdByName || '—')}</div>
  </div>
</div>

${doc.pickShort ? `<div class="short-warn">⚠ بعض الكميات غير متوفرة بالكامل في المخزون المتاح.</div>` : ''}

${orderBlocks}

${orders.length > 0 ? `<div class="grand-bar"><span>إجمالي القطع</span><span>${grandTotal} قطعة</span></div>` : ''}

<div class="sig-row">
  <div class="sig-box">
    <div class="sig-label">توقيع أمين المستودع<span>Warehouse Keeper Signature</span></div>
  </div>
  <div class="sig-box">
    <div class="sig-label">توقيع المشرف<span>Supervisor Signature</span></div>
  </div>
  <div class="sig-box">
    <div class="sig-label">التاريخ والوقت<span>Date &amp; Time</span></div>
  </div>
</div>

</section></body></html>`;
}

/** Packing List: clean per-order packing verification (reference-image style). */
export function renderBatchPackingListHtml(doc: BatchInstructionDocument): string {
  const byOrder = new Map<string, Array<{ sku: string; name: string; quantity: string }>>();
  for (const alloc of doc.allocations) {
    for (const split of alloc.splits) {
      const rows = byOrder.get(split.orderNumber) ?? [];
      rows.push({ sku: alloc.sku, name: alloc.name, quantity: split.quantity });
      byOrder.set(split.orderNumber, rows);
    }
  }
  const checklistByOrder = new Map(doc.checklist.map((row) => [row.orderNumber, row]));

  const sortedOrders = [...byOrder.entries()].sort((a, b) => {
    const ca = checklistByOrder.get(a[0])?.companyName || '—';
    const cb = checklistByOrder.get(b[0])?.companyName || '—';
    const byCompany = ca.localeCompare(cb, 'ar');
    return byCompany !== 0 ? byCompany : a[0].localeCompare(b[0], 'en', { numeric: true });
  });

  let orderBlocks = '';
  if (sortedOrders.length === 0) {
    orderBlocks = `<p style="color:#5e7368;font-size:13px;padding:12px 0;">لا توجد بنود للتعبئة في هذه المجموعة.</p>`;
  } else {
    let lastCompany = '';
    sortedOrders.forEach(([orderNumber, lines], index) => {
      const meta = checklistByOrder.get(orderNumber);
      const companyName = meta?.companyName || '—';
      if (companyName !== lastCompany) {
        orderBlocks += `<div class="company-sep">${esc(companyName)}</div>`;
        lastCompany = companyName;
      }
      const orderQty = lines.reduce((s, l) => s + (Number(String(l.quantity).replace(/,/g, '')) || 0), 0);
      const body = lines.map((line, i) => `<tr>
        <td class="idx">${i + 1}</td>
        <td class="sku-col">${esc(line.sku)}</td>
        <td class="product">${esc(line.name)}</td>
        <td class="qty">${esc(line.quantity)}</td>
        <td class="check"><span class="box"></span></td>
      </tr>`).join('');
      orderBlocks += `<div class="order-card">
        <div class="order-card-head">
          <div class="order-num">${index + 1}. ${esc(orderNumber)}</div>
          <div class="order-meta-row">
            <span class="order-customer">${esc(meta?.customerName || '—')}</span>
            ${meta?.customerPhone ? `<span class="order-phone">${esc(meta.customerPhone)}</span>` : ''}
            <span class="order-items">${orderQty} قطعة</span>
          </div>
        </div>
        <table class="pack-tbl">
          <thead><tr>
            <th class="idx">#</th>
            <th style="width:90px">الصنف<span>SKU</span></th>
            <th>المنتج<span>Product</span></th>
            <th style="width:60px;text-align:center;">الكمية<span>Qty</span></th>
            <th style="width:40px;text-align:center;">✓</th>
          </tr></thead>
          <tbody>${body}</tbody>
        </table>
        <div class="order-confirm-row">
          <span class="confirm-label">تم التحقق من محتوى الطلب<span>Contents Verified</span></span>
          <span class="box-lg"></span>
          <span class="confirm-label">تم تغليف الطلب بالكامل<span>Order Fully Packed</span></span>
          <span class="box-lg"></span>
        </div>
      </div>`;
    });
  }

  const title = doc.batchName ? `${doc.batchNumber} · ${doc.batchName}` : doc.batchNumber;

  return `<!DOCTYPE html>
<html lang="ar"><head><meta charset="utf-8" /><title>قائمة التعبئة ${esc(doc.batchNumber)}</title>
<style>${sharedStyles()}
  .simple-header { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; padding:0 0 12px; margin:0 0 14px; border-bottom:3px solid #0b5e3c; }
  .simple-brand { display:flex; align-items:center; gap:10px; }
  .simple-brand .logo { height:52px; width:auto; display:block; }
  .brand-block .brand-name { color:#0b5e3c; font-size:17px; font-weight:800; line-height:1.15; }
  .brand-block .brand-sub { color:#6d8276; font-size:11px; margin-top:1px; }
  .doc-info { text-align:right; }
  .doc-info h1 { margin:0; color:#0b5e3c; font-size:28px; font-weight:800; line-height:1.05; }
  .doc-info .doc-en { color:#6d8276; font-size:14px; margin-top:2px; }
  .meta-bar { display:flex; gap:0; margin:0 0 14px; border:1.5px solid #c5ddd2; border-radius:12px; overflow:hidden; background:#eaf6f0; }
  .meta-cell { flex:1; padding:9px 14px; border-left:1px solid #c5ddd2; }
  .meta-cell:first-child { border-left:none; }
  .meta-label { color:#5e7368; font-size:11px; font-weight:700; line-height:1.2; }
  .meta-label span { display:block; color:#8da699; font-size:10px; }
  .meta-val { color:#0b5e3c; font-size:15px; font-weight:800; margin-top:2px; line-height:1.2; }
  .company-sep { margin:16px 0 6px; padding:6px 12px; background:#eaf6f0; border-radius:8px; color:#0b5e3c; font-size:13px; font-weight:800; border-right:3px solid #0b5e3c; }
  .order-card { margin:0 0 14px; border:1.5px solid #c5ddd2; border-radius:12px; overflow:hidden; break-inside:avoid; page-break-inside:avoid; }
  .order-card-head { padding:10px 14px; background:#f0fbf5; border-bottom:1px solid #d5e9de; }
  .order-num { color:#0b5e3c; font-size:16px; font-weight:800; }
  .order-meta-row { display:flex; gap:12px; align-items:center; margin-top:4px; }
  .order-customer { color:#163028; font-size:13px; font-weight:700; }
  .order-phone { color:#5e7368; font-size:12px; direction:ltr; font-family:"Segoe UI",Tahoma,sans-serif; }
  .order-items { color:#0b5e3c; font-size:12px; font-weight:800; background:#d7efe4; padding:1px 8px; border-radius:999px; }
  .pack-tbl { width:100%; border-collapse:collapse; }
  .pack-tbl th { background:#d7efe4; color:#1d4d36; font-size:11.5px; font-weight:800; padding:6px 10px; text-align:right; border-bottom:1px solid #c5ddd2; }
  .pack-tbl th span { display:block; color:#6d8276; font-size:10px; font-weight:600; }
  .pack-tbl td { padding:6px 10px; font-size:12px; border-bottom:1px solid #eaf6f0; vertical-align:middle; }
  .pack-tbl td.idx { width:30px; text-align:center; color:#6d8276; font-weight:700; }
  .pack-tbl td.sku-col { color:#245443; font-weight:800; font-family:"Segoe UI",Tahoma,sans-serif; font-size:11.5px; }
  .pack-tbl td.product { font-weight:700; color:#163028; }
  .pack-tbl td.qty { text-align:center; color:#0b5e3c; font-size:14px; font-weight:900; }
  .pack-tbl td.check { text-align:center; }
  .box { display:inline-block; width:14px; height:14px; border:1.6px solid #0b5e3c; border-radius:3px; background:#fff; }
  .box-lg { display:inline-block; width:20px; height:20px; border:1.8px solid #0b5e3c; border-radius:4px; background:#fff; vertical-align:middle; margin:0 6px; }
  .order-confirm-row { display:flex; align-items:center; gap:4px; padding:8px 14px; background:#f7fcf9; border-top:1px solid #d5e9de; font-size:12px; color:#163028; font-weight:700; }
  .confirm-label span { display:inline; color:#6d8276; font-size:10.5px; margin-right:6px; }
  .dispatch-box { margin-top:16px; padding:12px 14px; border:1.5px solid #c5ddd2; border-radius:12px; background:#eaf6f0; }
  .dispatch-title { color:#0b5e3c; font-size:14px; font-weight:800; margin:0 0 8px; }
</style></head><body style="padding:14mm 14mm 10mm;"><section class="sheet">

<div class="simple-header">
  <div class="simple-brand">
    ${logoDataUri ? `<img class="logo" src="${logoDataUri}" alt="EMDAD" />` : ''}
    <div class="brand-block">
      <div class="brand-name">EMDAD Logistics</div>
      <div class="brand-sub">Logistics &amp; Warehousing</div>
    </div>
  </div>
  <div class="doc-info">
    <h1>قائمة التعبئة</h1>
    <div class="doc-en">Packing List</div>
  </div>
</div>

<div class="meta-bar">
  <div class="meta-cell">
    <div class="meta-label">رقم المجموعة<span>Batch</span></div>
    <div class="meta-val">${esc(title)}</div>
  </div>
  <div class="meta-cell">
    <div class="meta-label">التاريخ<span>Date</span></div>
    <div class="meta-val">${esc(doc.createdAtLabel || '—')}</div>
  </div>
  <div class="meta-cell">
    <div class="meta-label">الطلبات / القطع<span>Orders / Units</span></div>
    <div class="meta-val">${doc.orderCount} · ${esc(doc.unitTotal)}</div>
  </div>
  <div class="meta-cell">
    <div class="meta-label">بواسطة<span>Created by</span></div>
    <div class="meta-val">${esc(doc.createdByName || '—')}</div>
  </div>
</div>

${orderBlocks}

${doc.dispatchGroups.length > 0 ? `<div class="dispatch-box">
  <div class="dispatch-title">مكان الإرسال — Dispatch Location</div>
  ${locationBars(doc.dispatchGroups, 'مكان الإرسال', 'Dispatch Location')}
</div>` : ''}

</section></body></html>`;
}

export function renderBatchInstructionByKind(
  doc: BatchInstructionDocument,
  kind: BatchInstructionKind = 'full',
): string {
  if (kind === 'picking') return renderBatchPickingListHtml(doc);
  if (kind === 'packing') return renderBatchPackingListHtml(doc);
  return renderBatchInstructionHtml(doc);
}
