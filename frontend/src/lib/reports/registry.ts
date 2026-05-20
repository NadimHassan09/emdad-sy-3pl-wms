import { col } from './column-helpers';
import { getCatalogEntry } from './report-catalog';
import { runInventoryBalance, runInventoryMovement } from './report-runners';
import { runWarehouseAnalysisChart } from './warehouse-analysis';
import type { ReportDefinition } from './types';

const MOVEMENT_TYPES = [
  { value: 'inbound', label: 'Inbound', labelAr: 'وارد' },
  { value: 'outbound', label: 'Outbound', labelAr: 'صادر' },
  { value: 'adjustment', label: 'Adjustment', labelAr: 'تسوية' },
];

const STOCK_STATUS = [
  { value: 'available', label: 'Available', labelAr: 'متاح' },
  { value: 'quarantined', label: 'Quarantined', labelAr: 'حجر' },
];

function catalogMeta(id: ReportDefinition['id']) {
  const entry = getCatalogEntry(id)!;
  return {
    title: entry.title,
    titleAr: entry.titleAr,
    description: entry.description,
    descriptionAr: entry.descriptionAr,
  };
}

export const REPORT_REGISTRY: ReportDefinition[] = [
  {
    id: 'warehouse-analysis',
    ...catalogMeta('warehouse-analysis'),
    columns: [
      col('week', 'Week', 'الأسبوع', { sortable: true }),
      col('inboundCount', 'Inbound', 'وارد', { sortable: true, className: 'text-end' }),
      col('outboundCount', 'Outbound', 'صادر', { sortable: true, className: 'text-end' }),
      col('totalCount', 'Total', 'الإجمالي', { sortable: true, className: 'text-end' }),
    ],
    filterKeys: ['warehouse', 'client', 'dateRange'],
    defaultView: 'graph',
    supportedViews: ['table', 'graph', 'pivot'],
    defaultChartKind: 'line',
    chartLabelKey: 'week',
    chartValueKey: 'totalCount',
    exportFileName: 'warehouse-analysis',
    usesClientAggregation: true,
    loadsWarehouseKpis: true,
    category: 'operations',
    run: runWarehouseAnalysisChart,
  },
  {
    id: 'inventory',
    ...catalogMeta('inventory'),
    columns: [
      col('sku', 'SKU', 'رمز الصنف', { sortable: true }),
      col('product', 'Product', 'المنتج', { sortable: true }),
      col('client', 'Client', 'العميل', { sortable: true }),
      col('location', 'Location', 'الموقع', { sortable: true }),
      col('lot', 'Lot', 'الدفعة'),
      col('expiry', 'Expiry', 'الانتهاء'),
      col('onHand', 'On hand', 'في المخزون', { sortable: true }),
      col('reserved', 'Reserved', 'محجوز', { sortable: true }),
      col('available', 'Available', 'متاح', { sortable: true }),
      col('stockStatus', 'Status', 'الحالة', { sortable: true }),
      col('uom', 'UoM', 'وحدة'),
      col('warehouse', 'Warehouse', 'المستودع'),
    ],
    filterKeys: ['warehouse', 'client', 'sku', 'status'],
    statusOptions: STOCK_STATUS,
    groupByOptions: [
      { value: 'client', label: 'Client', labelAr: 'العميل' },
      { value: 'location', label: 'Location', labelAr: 'الموقع' },
      { value: 'stockStatus', label: 'Status', labelAr: 'الحالة' },
    ],
    defaultView: 'table',
    supportedViews: ['table', 'graph', 'pivot'],
    defaultChartKind: 'bar',
    chartLabelKey: 'client',
    chartValueKey: 'onHand',
    exportFileName: 'inventory',
    category: 'inventory',
    run: runInventoryBalance,
  },
  {
    id: 'product-moves',
    ...catalogMeta('product-moves'),
    columns: [
      col('date', 'Date', 'التاريخ', { sortable: true }),
      col('product', 'Product', 'المنتج', { sortable: true }),
      col('sku', 'SKU', 'رمز الصنف', { sortable: true }),
      col('client', 'Client', 'العميل', { sortable: true }),
      col('movement', 'Movement', 'الحركة', { sortable: true }),
      col('status', 'Status', 'الحالة'),
      col('quantity', 'Qty', 'الكمية', { sortable: true }),
      col('reference', 'Reference', 'المرجع'),
      col('operator', 'Operator', 'المشغّل', { sortable: true }),
      col('lot', 'Lot', 'الدفعة'),
      col('fromLocation', 'From', 'من'),
      col('toLocation', 'To', 'إلى'),
    ],
    filterKeys: ['warehouse', 'client', 'sku', 'status', 'dateRange', 'groupBy'],
    statusOptions: MOVEMENT_TYPES,
    groupByOptions: [
      { value: 'movement', label: 'Movement type', labelAr: 'نوع الحركة' },
      { value: 'client', label: 'Client', labelAr: 'العميل' },
      { value: 'sku', label: 'SKU', labelAr: 'رمز الصنف' },
    ],
    defaultView: 'table',
    supportedViews: ['table', 'graph', 'pivot'],
    defaultChartKind: 'line',
    chartLabelKey: 'date',
    chartValueKey: 'quantity',
    exportFileName: 'product-moves',
    category: 'inventory',
    run: runInventoryMovement,
  },
];

export const DEFAULT_REPORT_ID = REPORT_REGISTRY[0]!.id;

export function getReportById(id: string): ReportDefinition | undefined {
  return REPORT_REGISTRY.find((r) => r.id === id);
}
