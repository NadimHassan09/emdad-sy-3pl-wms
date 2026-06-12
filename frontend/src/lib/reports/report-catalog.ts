export type ReportCatalogId =
  | 'warehouse-analysis'
  | 'inventory'
  | 'product-moves'
  | 'worker-productivity'
  | 'order-cycle-time'
  | 'inbound-accuracy'
  | 'outbound-fill-rate'
  | 'sla-compliance';

export type ReportCatalogEntry = {
  id: ReportCatalogId;
  path: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  section?: 'inventory' | 'operations';
};

export const REPORT_CATALOG: ReportCatalogEntry[] = [
  {
    id: 'warehouse-analysis',
    path: '/reports/warehouse-analysis',
    title: 'Warehouse Analysis',
    titleAr: 'تحليل المستودع',
    description: 'Throughput, cycle times, and delays for client fulfillment.',
    descriptionAr: 'الإنتاجية وأوقات الدورة والتأخيرات.',
    section: 'operations',
  },
  {
    id: 'worker-productivity',
    path: '/reports/worker-productivity',
    title: 'Worker Productivity',
    titleAr: 'إنتاجية العمال',
    description: 'Completed tasks and average cycle time per warehouse operator.',
    descriptionAr: 'المهام المكتملة ومتوسط وقت الدورة لكل مشغل.',
    section: 'operations',
  },
  {
    id: 'order-cycle-time',
    path: '/reports/order-cycle-time',
    title: 'Order Cycle Time',
    titleAr: 'وقت دورة الطلب',
    description: 'Inbound receipt and outbound ship cycle duration by order.',
    descriptionAr: 'مدة دورة الاستلام والشحن لكل طلب.',
    section: 'operations',
  },
  {
    id: 'inbound-accuracy',
    path: '/reports/inbound-accuracy',
    title: 'Inbound Accuracy',
    titleAr: 'دقة الوارد',
    description: 'Received vs expected quantities and line discrepancies.',
    descriptionAr: 'الكميات المستلمة مقابل المتوقعة وفروقات الأسطر.',
    section: 'operations',
  },
  {
    id: 'outbound-fill-rate',
    path: '/reports/outbound-fill-rate',
    title: 'Outbound Fill Rate',
    titleAr: 'معدل تعبئة الصادر',
    description: 'Picked vs requested quantities and short-ship flags.',
    descriptionAr: 'الكميات الملتقطة مقابل المطلوبة ومؤشرات النقص.',
    section: 'operations',
  },
  {
    id: 'sla-compliance',
    path: '/reports/sla-compliance',
    title: 'SLA Compliance',
    titleAr: 'الالتزام باتفاقية مستوى الخدمة',
    description: 'On-time vs breached tasks by type with escalation counts.',
    descriptionAr: 'المهام في الوقت مقابل المتأخرة حسب النوع مع التصعيد.',
    section: 'operations',
  },
  {
    id: 'inventory',
    path: '/reports/inventory',
    title: 'Inventory',
    titleAr: 'المخزون',
    description: 'Client-owned stock by product, location, and lot.',
    descriptionAr: 'مخزون العملاء حسب المنتج والموقع.',
    section: 'inventory',
  },
  {
    id: 'product-moves',
    path: '/reports/product-moves',
    title: 'Product Moves',
    titleAr: 'حركات المنتجات',
    description: 'Stock movements with reference and operator.',
    descriptionAr: 'حركات المخزون مع المرجع والمشغّل.',
    section: 'inventory',
  },
];

export function getCatalogEntry(id: string): ReportCatalogEntry | undefined {
  return REPORT_CATALOG.find((r) => r.id === id);
}

export const DEFAULT_REPORT_PATH = REPORT_CATALOG[0]!.path;
