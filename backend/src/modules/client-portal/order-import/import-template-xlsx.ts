import ExcelJS from 'exceljs';
import type { Response } from 'express';

import { sanitizeExcelText } from '../../../common/utils/excel-export.util';
import hierarchyJson from '../../../data/syria-locations/syria-address-hierarchy.json';
import {
  INBOUND_CLIENT_IMPORT_HEADERS,
  getInboundClientImportTemplate,
} from './inbound-client-import.schema';
import {
  OMS_CLIENT_IMPORT_HEADERS,
  getOmsClientImportTemplate,
} from './oms-client-import.schema';
import {
  OUTBOUND_CLIENT_IMPORT_HEADERS,
  getOutboundClientImportTemplate,
} from './outbound-client-import.schema';

type Hierarchy = Record<string, Record<string, string[]>>;

const HIERARCHY = hierarchyJson as Hierarchy;

const COUNTRY_CODES = ['963', '961', '962', '964', '966', '971', '20', '90', '1', '44', '49', '33'];
const PAYMENT_METHODS = ['COD', 'Prepaid', 'Credit'];

const OMS_SAMPLE_ROWS: string[][] = [
  [
    'WA-20260901-001',
    '9/01/2026',
    'Ahmed Ali',
    '963',
    '944000001',
    'حلب',
    'أتارب',
    'أرناز',
    'شارع المتنبي - بناء السلام طابق 2',
    'COD',
    '',
    'SKU-A',
    'Sample product A',
    '2',
    '10',
  ],
  [
    'WA-20260901-001',
    '9/01/2026',
    'Ahmed Ali',
    '963',
    '944000001',
    'حلب',
    'أتارب',
    'أرناز',
    'شارع المتنبي - بناء السلام طابق 2',
    'COD',
    '',
    'SKU-B',
    'Sample product B',
    '3',
    '15',
  ],
  [
    'WA-20260902-002',
    '9/02/2026',
    'Sara Hassan',
    '963',
    '944000002',
    'حلب',
    'أتارب',
    'أرناز',
    'شارع الجمهورية - جانب حديقة تشرين',
    'Prepaid',
    '',
    'SKU-A',
    'Sample product A',
    '1',
    '10',
  ],
];

const INBOUND_SAMPLE_ROWS: string[][] = [
  ['INB-1001', '9/01/2026', '', 'Sample product A', 'SKU-A', '10'],
  ['INB-1001', '9/01/2026', '', 'Sample product B', 'SKU-B', '5'],
  ['INB-1002', '9/02/2026', 'PO-88', 'Sample product A', 'SKU-A', '3'],
];

const OUTBOUND_SAMPLE_ROWS: string[][] = [
  ['OUT-1001', '2026-09-01', 'Damascus warehouse dock A', '', 'SKU-A', '2'],
  ['OUT-1001', '', '', '', 'SKU-B', '3'],
  ['OUT-1002', '2026-09-02', 'Aleppo store 12', '', 'SKU-A', '1'],
];

/** 1-based column index → Excel column letters (1 → A, 27 → AA). */
export function excelColumnLetter(index1Based: number): string {
  let n = index1Based;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function styleHeaderRow(row: ExcelJS.Row, colCount: number): void {
  row.height = 22;
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1B6B3A' },
    };
    cell.alignment = { vertical: 'middle', wrapText: true };
  }
}

function applyListValidation(
  sheet: ExcelJS.Worksheet,
  colLetter: string,
  startRow: number,
  endRow: number,
  formula: string,
  errorTitle: string,
  error: string,
): void {
  for (let r = startRow; r <= endRow; r++) {
    sheet.getCell(`${colLetter}${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [formula.replace(/\$ROW/g, String(r))],
      showErrorMessage: true,
      errorTitle,
      error,
      showInputMessage: false,
    };
  }
}

function parseCsvBodyToRows(body: string): string[][] {
  const lines = body.replace(/^\uFEFF/, '').trim().split('\n');
  return lines.map((line) => {
    // Simple CSV split sufficient for our own template rows (no embedded commas in samples beyond quoted).
    const cells: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === ',' && !inQuotes) {
        cells.push(cur);
        cur = '';
        continue;
      }
      cur += ch;
    }
    cells.push(cur);
    return cells;
  });
}

function addInstructionsSheet(
  workbook: ExcelJS.Workbook,
  lines: Array<{ ar: string; en: string }>,
): void {
  const sheet = workbook.addWorksheet('Instructions', {
    views: [{ rightToLeft: false }],
  });
  sheet.getColumn(1).width = 72;
  sheet.getColumn(2).width = 72;

  const title = sheet.getRow(1);
  title.getCell(1).value = 'تعليمات — Instructions';
  title.getCell(1).font = { name: 'Arial', bold: true, size: 14, color: { argb: 'FF1B6B3A' } };
  title.height = 28;

  const header = sheet.getRow(2);
  header.getCell(1).value = 'العربية';
  header.getCell(2).value = 'English';
  styleHeaderRow(header, 2);

  lines.forEach((line, idx) => {
    const row = sheet.getRow(idx + 3);
    row.getCell(1).value = line.ar;
    row.getCell(2).value = line.en;
    row.getCell(1).alignment = { wrapText: true, vertical: 'top', readingOrder: 'rtl' };
    row.getCell(2).alignment = { wrapText: true, vertical: 'top' };
    row.height = 36;
  });
}

function buildSyriaLists(workbook: ExcelJS.Workbook): {
  governorateCount: number;
  cityCount: number;
  areaCount: number;
} {
  const lists = workbook.addWorksheet('Lists');
  const areas = workbook.addWorksheet('Areas');

  // A: country codes, B: payment, C: governorates
  lists.getCell('A1').value = 'country_code';
  lists.getCell('B1').value = 'payment_method';
  lists.getCell('C1').value = 'governorate';
  COUNTRY_CODES.forEach((v, i) => {
    lists.getCell(`A${i + 2}`).value = v;
  });
  PAYMENT_METHODS.forEach((v, i) => {
    lists.getCell(`B${i + 2}`).value = v;
  });

  const governorates = Object.keys(HIERARCHY).sort((a, b) => a.localeCompare(b, 'ar'));
  governorates.forEach((g, i) => {
    lists.getCell(`C${i + 2}`).value = g;
  });

  workbook.definedNames.add(
    'CountryCodes',
    `Lists!$A$2:$A$${COUNTRY_CODES.length + 1}`,
  );
  workbook.definedNames.add(
    'PaymentMethods',
    `Lists!$B$2:$B$${PAYMENT_METHODS.length + 1}`,
  );
  workbook.definedNames.add(
    'Governorates',
    `Lists!$C$2:$C$${governorates.length + 1}`,
  );

  // One column per governorate for dependent city lists (D onwards).
  let cityCount = 0;
  governorates.forEach((gov, govIdx) => {
    const col = excelColumnLetter(4 + govIdx); // D = 4
    lists.getCell(`${col}1`).value = gov;
    const cities = Object.keys(HIERARCHY[gov] ?? {}).sort((a, b) => a.localeCompare(b, 'ar'));
    cities.forEach((city, i) => {
      lists.getCell(`${col}${i + 2}`).value = city;
    });
    cityCount += cities.length;
    const end = Math.max(cities.length + 1, 2);
    workbook.definedNames.add(`Cities_${govIdx}`, `Lists!$${col}$2:$${col}$${end}`);
  });

  // Flat unique areas for neighborhood dropdown (typo guard; import still validates hierarchy).
  const areaSet = new Set<string>();
  for (const gov of governorates) {
    for (const city of Object.keys(HIERARCHY[gov] ?? {})) {
      for (const area of HIERARCHY[gov]![city] ?? []) {
        areaSet.add(area);
      }
    }
  }
  const areaList = [...areaSet].sort((a, b) => a.localeCompare(b, 'ar'));
  areas.getCell('A1').value = 'neighborhood';
  areaList.forEach((a, i) => {
    areas.getCell(`A${i + 2}`).value = a;
  });
  workbook.definedNames.add('Areas', `Areas!$A$2:$A$${Math.max(areaList.length + 1, 2)}`);

  lists.state = 'hidden';
  areas.state = 'hidden';

  return {
    governorateCount: governorates.length,
    cityCount,
    areaCount: areaList.length,
  };
}

async function workbookToBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  const raw = await workbook.xlsx.writeBuffer();
  return Buffer.from(raw);
}

const OMS_INSTRUCTIONS: Array<{ ar: string; en: string }> = [
  {
    ar: 'املأ ورقة Orders فقط. لا تعدّل أو تحذف أوراق Instructions / Lists / Areas.',
    en: 'Fill the Orders sheet only. Do not edit or delete Instructions / Lists / Areas.',
  },
  {
    ar: 'العملة ثابتة USD — لا يوجد عمود عملة. السعر والـ COD بالدولار.',
    en: 'Currency is fixed to USD — there is no currency column. Prices and COD are in USD.',
  },
  {
    ar: 'الأعمدة الإلزامية: order_number, required_ship_date, recipient_name, country_code, recipient_phone, governorate, city, neighborhood, street, payment_method, sku, quantity, unit_price.',
    en: 'Required columns: order_number, required_ship_date, recipient_name, country_code, recipient_phone, governorate, city, neighborhood, street, payment_method, sku, quantity, unit_price.',
  },
  {
    ar: 'product_name للتوضيح فقط ويتم تجاهله عند الاستيراد. استخدم SKU المنتج كما في النظام.',
    en: 'product_name is documentation-only and ignored on import. Use the product SKU from the system.',
  },
  {
    ar: 'التاريخ: YYYY-MM-DD أو M/DD/YYYY (مثال 2026-09-01 أو 9/01/2026). أرقام إنجليزية. إن كان اليوم > 12 يُقبل أيضاً DD/MM/YYYY.',
    en: 'Dates: YYYY-MM-DD or M/DD/YYYY (e.g. 2026-09-01 or 9/01/2026). English digits. If day > 12, DD/MM/YYYY is also accepted.',
  },
  {
    ar: 'رمز الدولة: أرقام فقط مثل 963 (مقبول أيضاً +963). الهاتف: أرقام وطنية مثل 944000001 أو 0944000001 أو +963944000001.',
    en: 'Country code: digits only such as 963 (+963 also accepted). Phone: national digits like 944000001, 0944000001, or +963944000001.',
  },
  {
    ar: 'المحافظة / المدينة / الحي: اختر من القوائم المنسدلة. المدينة تعتمد على المحافظة. يجب أن تطابق القائمة الرسمية.',
    en: 'Governorate / city / neighborhood: use the drop-downs. City depends on governorate. Values must match the official list.',
  },
  {
    ar: 'طريقة الدفع: COD أو Prepaid أو Credit فقط.',
    en: 'Payment method: COD, Prepaid, or Credit only.',
  },
  {
    ar: 'سطر الشارع (التفصيل) إلزامي وأطول من 10 أحرف.',
    en: 'Street / detailed address is required and must be more than 10 characters.',
  },
  {
    ar: 'عدة أسطر بنفس order_number = نفس الطلبية بمنتجات متعددة. اترك الحقول على مستوى الطلبية متطابقة.',
    en: 'Multiple rows with the same order_number = one order with multiple products. Keep order-level fields identical.',
  },
  {
    ar: 'عند وجود أخطاء، حمّل تقرير الأخطاء، صحّح الصفوف، وأعد الرفع. الاستيراد يتسامح مع المسافات وأحرف عربية متقاربة (ي/ى، ة/ه، أ/ا).',
    en: 'On errors, download the error report, fix the rows, and re-upload. Import tolerates trim and Arabic letter variants (ي/ى, ة/ه, أ/ا).',
  },
  {
    ar: 'ملف CSV ما زال مدعوماً: أضف ?format=csv لرابط القالب إن احتجته.',
    en: 'CSV is still supported: append ?format=csv to the template URL if needed.',
  },
];

const INBOUND_INSTRUCTIONS: Array<{ ar: string; en: string }> = [
  {
    ar: 'املأ ورقة Orders فقط. هذا قالب الوارد (Inbound).',
    en: 'Fill the Orders sheet only. This is the inbound template.',
  },
  {
    ar: 'الأعمدة الإلزامية: order_number, expected_arrival_date, sku, quantity.',
    en: 'Required columns: order_number, expected_arrival_date, sku, quantity.',
  },
  {
    ar: 'product_name للتوضيح فقط. التاريخ بنفس صيغ OMS (YYYY-MM-DD أو M/DD/YYYY).',
    en: 'product_name is documentation-only. Dates use the same formats as OMS (YYYY-MM-DD or M/DD/YYYY).',
  },
  {
    ar: 'عدة أسطر بنفس order_number = نفس أمر الوارد بعدة منتجات.',
    en: 'Multiple rows with the same order_number = one inbound order with multiple products.',
  },
];

const OUTBOUND_INSTRUCTIONS: Array<{ ar: string; en: string }> = [
  {
    ar: 'املأ ورقة Orders فقط. هذا قالب الصادر (Outbound).',
    en: 'Fill the Orders sheet only. This is the outbound template.',
  },
  {
    ar: 'الأعمدة الإلزامية: order_number, sku, requested_quantity. العنوان والتاريخ اختياريان على مستوى الطلبية.',
    en: 'Required columns: order_number, sku, requested_quantity. Destination and ship date are optional order-level fields.',
  },
  {
    ar: 'التاريخ: YYYY-MM-DD أو M/DD/YYYY إن وُجد.',
    en: 'Dates: YYYY-MM-DD or M/DD/YYYY when provided.',
  },
];

export async function buildOmsImportTemplateXlsx(): Promise<{
  filename: string;
  buffer: Buffer;
  meta: { governorateCount: number; cityCount: number; areaCount: number };
}> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EMDAD 3PL WMS/OMS';
  workbook.created = new Date();

  const orders = workbook.addWorksheet('Orders');
  const headers = [...OMS_CLIENT_IMPORT_HEADERS];
  orders.addRow(headers.map((h) => sanitizeExcelText(h)));
  styleHeaderRow(orders.getRow(1), headers.length);
  for (const sample of OMS_SAMPLE_ROWS) {
    orders.addRow(sample.map((c) => sanitizeExcelText(c)));
  }
  headers.forEach((_, i) => {
    orders.getColumn(i + 1).width = Math.min(28, Math.max(12, headers[i]!.length + 4));
  });

  const meta = buildSyriaLists(workbook);
  addInstructionsSheet(workbook, OMS_INSTRUCTIONS);

  const dataEnd = 500;
  applyListValidation(orders, 'D', 2, dataEnd, 'CountryCodes', 'Country code', 'Pick a dialing code from the list (e.g. 963).');
  applyListValidation(
    orders,
    'F',
    2,
    dataEnd,
    'Governorates',
    'Governorate',
    'Pick a Syria governorate from the list.',
  );
  applyListValidation(
    orders,
    'G',
    2,
    dataEnd,
    'INDIRECT("Cities_"&(MATCH(F$ROW,Governorates,0)-1))',
    'City',
    'Pick a city that belongs to the selected governorate.',
  );
  applyListValidation(
    orders,
    'H',
    2,
    dataEnd,
    'Areas',
    'Neighborhood',
    'Pick a neighborhood from the list (must match the city).',
  );
  applyListValidation(
    orders,
    'J',
    2,
    dataEnd,
    'PaymentMethods',
    'Payment',
    'Payment method must be COD, Prepaid, or Credit.',
  );

  // Move Instructions after Orders visually: ExcelJS order is creation order;
  // re-order so Orders, Instructions, Lists, Areas.
  workbook.views = [];
  const buffer = await workbookToBuffer(workbook);
  return {
    filename: 'oms-orders-import-template.xlsx',
    buffer,
    meta,
  };
}

export async function buildInboundImportTemplateXlsx(): Promise<{
  filename: string;
  buffer: Buffer;
}> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EMDAD 3PL WMS/OMS';
  workbook.created = new Date();
  const orders = workbook.addWorksheet('Orders');
  const headers = [...INBOUND_CLIENT_IMPORT_HEADERS];
  orders.addRow(headers.map((h) => sanitizeExcelText(h)));
  styleHeaderRow(orders.getRow(1), headers.length);
  for (const sample of INBOUND_SAMPLE_ROWS) {
    orders.addRow(sample.map((c) => sanitizeExcelText(c)));
  }
  headers.forEach((_, i) => {
    orders.getColumn(i + 1).width = Math.min(28, Math.max(12, headers[i]!.length + 4));
  });
  addInstructionsSheet(workbook, INBOUND_INSTRUCTIONS);
  const buffer = await workbookToBuffer(workbook);
  return { filename: 'inbound-orders-import-template.xlsx', buffer };
}

export async function buildOutboundImportTemplateXlsx(): Promise<{
  filename: string;
  buffer: Buffer;
}> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EMDAD 3PL WMS/OMS';
  workbook.created = new Date();
  const orders = workbook.addWorksheet('Orders');
  const headers = [...OUTBOUND_CLIENT_IMPORT_HEADERS];
  orders.addRow(headers.map((h) => sanitizeExcelText(h)));
  styleHeaderRow(orders.getRow(1), headers.length);
  for (const sample of OUTBOUND_SAMPLE_ROWS) {
    orders.addRow(sample.map((c) => sanitizeExcelText(c)));
  }
  headers.forEach((_, i) => {
    orders.getColumn(i + 1).width = Math.min(28, Math.max(14, headers[i]!.length + 4));
  });
  addInstructionsSheet(workbook, OUTBOUND_INSTRUCTIONS);
  const buffer = await workbookToBuffer(workbook);
  return { filename: 'outbound-orders-import-template.xlsx', buffer };
}

/** Sanity: CSV template body still parses and shares the same OMS headers. */
export function assertOmsCsvTemplateAligned(): void {
  const csv = getOmsClientImportTemplate();
  const rows = parseCsvBodyToRows(csv.body);
  const header = rows[0] ?? [];
  for (const h of OMS_CLIENT_IMPORT_HEADERS) {
    if (!header.includes(h)) {
      throw new Error(`CSV template missing header ${h}`);
    }
  }
  void getInboundClientImportTemplate;
  void getOutboundClientImportTemplate;
}

/** Serve xlsx by default; `?format=csv` keeps the legacy CSV template. */
export async function sendImportTemplateResponse(
  res: Response,
  format: string | undefined,
  getCsv: () => { filename: string; body: string },
  getXlsx: () => Promise<{ filename: string; buffer: Buffer }>,
): Promise<void> {
  if (String(format ?? '').toLowerCase() === 'csv') {
    const result = getCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.body);
    return;
  }
  const result = await getXlsx();
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.send(result.buffer);
}
