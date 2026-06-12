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

const TASK_TYPE_FILTER = [
  { value: 'receiving', label: 'Receiving', labelAr: 'استلام' },
  { value: 'putaway', label: 'Putaway', labelAr: 'تخزين' },
  { value: 'pick', label: 'Pick', labelAr: 'التقاط' },
  { value: 'pack', label: 'Pack', labelAr: 'تغليف' },
  { value: 'dispatch', label: 'Dispatch', labelAr: 'تسليم' },
];

const noopRun = async () => [] as never[];

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
    serverSide: true,
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
    serverSide: true,
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
    serverSide: true,
    category: 'inventory',
    run: runInventoryMovement,
  },
  {
    id: 'worker-productivity',
    ...catalogMeta('worker-productivity'),
    columns: [
      col('worker', 'Worker', 'العامل', { sortable: true }),
      col('completedTasks', 'Completed', 'مكتمل', { sortable: true, className: 'text-end' }),
      col('taskTypes', 'Task types', 'أنواع المهام'),
      col('avgCycleHours', 'Avg cycle (h)', 'متوسط الدورة (س)', { sortable: true, className: 'text-end' }),
      col('pickPackCount', 'Pick/pack', 'التقاط/تغليف', { sortable: true, className: 'text-end' }),
    ],
    filterKeys: ['warehouse', 'client', 'dateRange', 'status'],
    statusOptions: TASK_TYPE_FILTER,
    groupByOptions: [
      { value: 'taskTypes', label: 'Task types', labelAr: 'أنواع المهام' },
    ],
    defaultView: 'table',
    supportedViews: ['table', 'graph', 'pivot'],
    defaultChartKind: 'bar',
    chartLabelKey: 'worker',
    chartValueKey: 'completedTasks',
    exportFileName: 'worker-productivity',
    serverSide: true,
    category: 'operations',
    run: noopRun,
  },
  {
    id: 'order-cycle-time',
    ...catalogMeta('order-cycle-time'),
    columns: [
      col('orderType', 'Type', 'النوع', { sortable: true }),
      col('orderNumber', 'Order #', 'رقم الطلب', { sortable: true }),
      col('client', 'Client', 'العميل', { sortable: true }),
      col('status', 'Status', 'الحالة', { sortable: true }),
      col('cycleHours', 'Cycle (h)', 'الدورة (س)', { sortable: true, className: 'text-end' }),
      col('milestoneStart', 'Start', 'البداية'),
      col('milestoneEnd', 'End', 'النهاية'),
    ],
    filterKeys: ['warehouse', 'client', 'dateRange'],
    groupByOptions: [
      { value: 'orderType', label: 'Order type', labelAr: 'نوع الطلب' },
      { value: 'client', label: 'Client', labelAr: 'العميل' },
    ],
    defaultView: 'table',
    supportedViews: ['table', 'graph', 'pivot'],
    defaultChartKind: 'bar',
    chartLabelKey: 'orderNumber',
    chartValueKey: 'cycleHours',
    exportFileName: 'order-cycle-time',
    serverSide: true,
    category: 'operations',
    run: noopRun,
  },
  {
    id: 'inbound-accuracy',
    ...catalogMeta('inbound-accuracy'),
    columns: [
      col('orderNumber', 'Order #', 'رقم الطلب', { sortable: true }),
      col('client', 'Client', 'العميل', { sortable: true }),
      col('status', 'Status', 'الحالة', { sortable: true }),
      col('lineCount', 'Lines', 'الأسطر', { sortable: true, className: 'text-end' }),
      col('discrepancyLines', 'Discrepancies', 'فروقات', { sortable: true, className: 'text-end' }),
      col('accuracyPercent', 'Accuracy', 'الدقة', { sortable: true, className: 'text-end' }),
      col('receivedVsExpected', 'Recv/exp', 'مستلم/متوقع'),
    ],
    filterKeys: ['warehouse', 'client', 'dateRange'],
    groupByOptions: [{ value: 'client', label: 'Client', labelAr: 'العميل' }],
    defaultView: 'table',
    supportedViews: ['table', 'graph', 'pivot'],
    defaultChartKind: 'bar',
    chartLabelKey: 'client',
    chartValueKey: 'accuracyPercent',
    exportFileName: 'inbound-accuracy',
    serverSide: true,
    category: 'operations',
    run: noopRun,
  },
  {
    id: 'outbound-fill-rate',
    ...catalogMeta('outbound-fill-rate'),
    columns: [
      col('orderNumber', 'Order #', 'رقم الطلب', { sortable: true }),
      col('client', 'Client', 'العميل', { sortable: true }),
      col('status', 'Status', 'الحالة', { sortable: true }),
      col('requestedQty', 'Requested', 'مطلوب', { sortable: true, className: 'text-end' }),
      col('pickedQty', 'Picked', 'ملتقط', { sortable: true, className: 'text-end' }),
      col('fillRatePercent', 'Fill rate', 'معدل التعبئة', { sortable: true, className: 'text-end' }),
      col('shortShip', 'Short ship', 'نقص', { sortable: true }),
    ],
    filterKeys: ['warehouse', 'client', 'dateRange'],
    groupByOptions: [{ value: 'client', label: 'Client', labelAr: 'العميل' }],
    defaultView: 'table',
    supportedViews: ['table', 'graph', 'pivot'],
    defaultChartKind: 'bar',
    chartLabelKey: 'client',
    chartValueKey: 'fillRatePercent',
    exportFileName: 'outbound-fill-rate',
    serverSide: true,
    category: 'operations',
    run: noopRun,
  },
  {
    id: 'sla-compliance',
    ...catalogMeta('sla-compliance'),
    columns: [
      col('taskType', 'Task type', 'نوع المهمة', { sortable: true }),
      col('totalTasks', 'Total', 'الإجمالي', { sortable: true, className: 'text-end' }),
      col('onTimeTasks', 'On time', 'في الوقت', { sortable: true, className: 'text-end' }),
      col('breachedTasks', 'Breached', 'متأخر', { sortable: true, className: 'text-end' }),
      col('escalatedTasks', 'Escalated', 'مُصعَّد', { sortable: true, className: 'text-end' }),
      col('compliancePercent', 'Compliance', 'الالتزام', { sortable: true, className: 'text-end' }),
    ],
    filterKeys: ['warehouse', 'client', 'dateRange', 'status'],
    statusOptions: TASK_TYPE_FILTER,
    groupByOptions: [{ value: 'taskType', label: 'Task type', labelAr: 'نوع المهمة' }],
    defaultView: 'graph',
    supportedViews: ['table', 'graph', 'pivot'],
    defaultChartKind: 'bar',
    chartLabelKey: 'taskType',
    chartValueKey: 'compliancePercent',
    exportFileName: 'sla-compliance',
    serverSide: true,
    category: 'operations',
    run: noopRun,
  },
];

export const DEFAULT_REPORT_ID = REPORT_REGISTRY[0]!.id;

export function getReportById(id: string): ReportDefinition | undefined {
  return REPORT_REGISTRY.find((r) => r.id === id);
}
