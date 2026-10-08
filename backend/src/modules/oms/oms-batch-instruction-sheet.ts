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

/** Picking List: aggregated pick + verification + packing destination. */
export function renderBatchPickingListHtml(doc: BatchInstructionDocument): string {
  // Section 1 — rows grouped by location, with per-product totals when split across locations.
  const productTotals = new Map<string, { sku: string; name: string; total: number; locs: Array<{ location: string; qty: number }> }>();
  for (const location of doc.locations) {
    const locLabel = [location.locationName, location.locationCode].filter(Boolean).join(' · ') || '—';
    for (const row of location.rows) {
      const key = `${row.sku}\u0000${row.name}`;
      const qty = Number(String(row.quantity).replace(/,/g, '')) || 0;
      const bucket = productTotals.get(key) ?? { sku: row.sku, name: row.name, total: 0, locs: [] };
      bucket.total += qty;
      bucket.locs.push({ location: locLabel, qty });
      productTotals.set(key, bucket);
    }
  }

  let pickRows = '';
  let idx = 0;
  if (productTotals.size === 0) {
    pickRows = `<tr><td class="empty" colspan="4">لا توجد كميات للالتقاط.<span>No pick quantities found.</span></td></tr>`;
  } else {
    for (const product of [...productTotals.values()].sort((a, b) => a.sku.localeCompare(b.sku) || a.name.localeCompare(b.name))) {
      for (const loc of product.locs) {
        idx += 1;
        pickRows += `<tr>
          <td class="idx">${idx}</td>
          <td class="product">${esc(product.name)}<div class="sku">${esc(product.sku)}</div></td>
          <td>${esc(loc.location)}</td>
          <td class="qty">${esc(String(loc.qty))}</td>
        </tr>`;
      }
      if (product.locs.length > 1) {
        pickRows += `<tr class="loc-banner">
          <td colspan="3"><strong>${esc(product.name)}</strong> — الإجمالي<span>Product Total</span></td>
          <td class="qty">${esc(String(product.total))}</td>
        </tr>`;
      }
    }
  }

  const verifyBody =
    productTotals.size === 0
      ? `<tr><td class="empty" colspan="5">—</td></tr>`
      : [...productTotals.values()]
          .sort((a, b) => a.sku.localeCompare(b.sku) || a.name.localeCompare(b.name))
          .map(
            (product, i) => `<tr>
              <td class="idx">${i + 1}</td>
              <td class="product">${esc(product.name)}<div class="sku">${esc(product.sku)}</div></td>
              <td class="qty">${esc(String(product.total))}</td>
              <td class="qty" style="border-bottom:1.5px solid #0b5e3c;">&nbsp;</td>
              <td class="check"><span class="box"></span></td>
            </tr>`,
          )
          .join('');

  return `<!DOCTYPE html>
<html lang="ar"><head><meta charset="utf-8" /><title>قائمة الالتقاط ${esc(doc.batchNumber)}</title>
<style>${sharedStyles()}
  td.product .sku { margin-top:2px; color:#5e7368; font-size:11px; font-weight:700; }
</style></head><body><section class="sheet">
${mastHeader(doc, 'قائمة الالتقاط', 'Picking List')}

<section class="stage stage-flow">
  <div class="stage-head">
    <div class="stage-main">
      <span class="step">1</span>
      <div class="stage-copy">
        <h2>التقاط مجمّع <span>(Aggregated Picking)</span></h2>
        <p>Collect total quantity from each location across the batch</p>
      </div>
    </div>
    <div class="stage-hint">اجمع الكمية من كل موقع. لو المنتج موزع على أكثر من مكان ستظهر كميات منفصلة ثم الإجمالي.<span>Split locations show per-bin qty then product total.</span></div>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr>
        <th class="idx">#</th>
        <th>المنتج<span>Product</span></th>
        <th>الموقع<span>Location</span></th>
        <th>الكمية<span>Qty</span></th>
      </tr></thead>
      <tbody>${pickRows}</tbody>
    </table>
  </div>
  ${doc.pickShort ? '<p class="pick-note">بعض الكميات غير متوفرة بالكامل في المخزون المتاح.</p>' : ''}
</section>

<section class="stage stage-flow">
  <div class="stage-head">
    <div class="stage-main">
      <span class="step">2</span>
      <div class="stage-copy">
        <h2>التحقق من الالتقاط <span>(Picking Verification)</span></h2>
        <p>Confirm consolidated totals after picking</p>
      </div>
    </div>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr>
        <th class="idx">#</th>
        <th>المنتج<span>Product</span></th>
        <th>المطلوب<span>Required</span></th>
        <th>الملتقط<span>Picked</span></th>
        <th>تم التحقق<span>Verified</span></th>
      </tr></thead>
      <tbody>${verifyBody}</tbody>
    </table>
  </div>
</section>

<section class="stage stage-keep">
  <div class="stage-head">
    <div class="stage-main">
      <span class="step">3</span>
      <div class="stage-copy">
        <h2>مكان التعبئة <span>(Packing Location)</span></h2>
        <p>Deliver picked items here after picking is complete</p>
      </div>
    </div>
  </div>
  ${locationBars(doc.packingGroups, 'مكان التعبئة', 'Packing Location')}
</section>
</section></body></html>`;
}

/** Packing List: redistribute picks to orders with 4-level verification + dispatch. */
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

  const allocationBody =
    doc.allocations.length === 0
      ? `<tr><td class="empty" colspan="3">لا يوجد توزيع على الطلبات.<span>No order allocation.</span></td></tr>`
      : doc.allocations
          .map(
            (row) => `<tr>
              <td class="product">${esc(row.name)}<div class="sku">${esc(row.sku)}</div></td>
              <td class="qty">${esc(row.total)}</td>
              <td class="split">${row.splits
                .map((split) => `<span class="pill">${esc(split.orderNumber)} <b>${esc(split.quantity)}</b></span>`)
                .join('')}</td>
            </tr>`,
          )
          .join('');

  const sortedOrders = [...byOrder.entries()].sort((a, b) => {
    const companyA = checklistByOrder.get(a[0])?.companyName || '—';
    const companyB = checklistByOrder.get(b[0])?.companyName || '—';
    const byCompany = companyA.localeCompare(companyB, 'ar');
    if (byCompany !== 0) return byCompany;
    return a[0].localeCompare(b[0], 'en', { numeric: true });
  });

  let orderBlocks = '';
  if (sortedOrders.length === 0) {
    orderBlocks = `<p class="pick-note">لا توجد بنود للتعبئة في هذه المجموعة.</p>`;
  } else {
    let lastCompany = '';
    let index = 0;
    for (const [orderNumber, lines] of sortedOrders) {
      const meta = checklistByOrder.get(orderNumber);
      const companyName = meta?.companyName || '—';
      if (companyName !== lastCompany) {
        orderBlocks += `<div class="company-banner">العميل / Client: ${esc(companyName)}</div>`;
        lastCompany = companyName;
      }
      index += 1;
      const body = lines
        .map(
          (line, i) => `<tr>
            <td class="idx">${i + 1}</td>
            <td class="product">${esc(line.name)}<div class="sku">${esc(line.sku)}</div></td>
            <td class="qty">${esc(line.quantity)}</td>
            <td class="check"><span class="box"></span></td>
            <td class="check"><span class="box"></span></td>
          </tr>`,
        )
        .join('');
      orderBlocks += `<div class="order-block">
        <h3>${index}. ${esc(orderNumber)} <span style="color:#5e7368;font-weight:700;">(${esc(companyName)})</span></h3>
        <div class="order-meta">
          <span>${esc(meta?.customerName || '—')}</span>
          <span class="phone">${esc(meta?.customerPhone || '—')}</span>
          <span>${esc(meta?.itemCount || '0')} قطعة</span>
        </div>
        <table>
          <thead><tr>
            <th class="idx">#</th>
            <th>المنتج<span>Product</span></th>
            <th>الكمية<span>Qty</span></th>
            <th>الكمية صحيحة<span>Qty Verified</span></th>
            <th>تم تغليف المنتج<span>Product Packed</span></th>
          </tr></thead>
          <tbody>${body}</tbody>
        </table>
        <div class="table-wrap" style="padding:8px 0 0">
          <table>
            <thead><tr>
              <th>تحقق من محتوى الطلب<span>Order Contents Verified</span></th>
              <th>تغليف الطلب كامل<span>Order Packed</span></th>
            </tr></thead>
            <tbody><tr>
              <td class="check"><span class="box" style="width:22px;height:22px;"></span></td>
              <td class="check"><span class="box" style="width:22px;height:22px;"></span></td>
            </tr></tbody>
          </table>
        </div>
      </div>`;
    }
  }

  return `<!DOCTYPE html>
<html lang="ar"><head><meta charset="utf-8" /><title>قائمة التعبئة ${esc(doc.batchNumber)}</title>
<style>${sharedStyles()}
  td.product .sku { margin-top:2px; color:#5e7368; font-size:11px; font-weight:700; }
</style></head><body><section class="sheet">
${mastHeader(doc, 'قائمة التعبئة', 'Packing List')}

<section class="stage stage-flow">
  <div class="stage-head">
    <div class="stage-main">
      <span class="step">1</span>
      <div class="stage-copy">
        <h2>توزيع المنتجات على الطلبات <span>(Allocate to Orders)</span></h2>
        <p>Split aggregated picks back across each order</p>
      </div>
    </div>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr>
        <th>المنتج<span>Product</span></th>
        <th>المجموع<span>Total</span></th>
        <th>الطلب ← الكمية<span>Order → Qty</span></th>
      </tr></thead>
      <tbody>${allocationBody}</tbody>
    </table>
  </div>
</section>

<section class="stage stage-flow">
  <div class="stage-head">
    <div class="stage-main">
      <span class="step">2</span>
      <div class="stage-copy">
        <h2>التحقق لكل طلب <span>(Per-order Verification)</span></h2>
        <p>Qty verified → Product packed → Order verified → Order packed</p>
      </div>
    </div>
    <div class="stage-hint">راجع منتجات كل طلب ثم أكّد الطلب كاملًا وتغليفه.<span>Four-level check per order.</span></div>
  </div>
  ${PACKING_STEPS}
  ${orderBlocks}
</section>

<section class="stage stage-keep">
  <div class="stage-head">
    <div class="stage-main">
      <span class="step">3</span>
      <div class="stage-copy">
        <h2>مكان الإرسال <span>(Dispatch Location)</span></h2>
        <p>Place fully packed orders here awaiting outbound</p>
      </div>
    </div>
  </div>
  ${locationBars(doc.dispatchGroups, 'مكان الإرسال', 'Dispatch Location')}
</section>
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
