export type ReportCatalogId =
  | 'warehouse-analysis'
  | 'inventory'
  | 'product-moves'
  | 'stock-aging'
  | 'lot-expiry'
  | 'capacity-utilization'
  | 'return-rate'
  | 'worker-productivity'
  | 'order-cycle-time'
  | 'inbound-accuracy'
  | 'outbound-fill-rate'
  | 'sla-compliance'
  | 'revenue-by-client'
  | 'receivables-aging'
  | 'cod-report'
  | 'merchant-orders'
  | 'sales-report'
  | 'returns-report'
  | 'delivery-report'
  | 'allocation-report'
  | 'inventory-reserved';

export type ReportCatalogEntry = {
  id: ReportCatalogId;
  path: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  section?: 'inventory' | 'operations' | 'finance' | 'oms';
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
  {
    id: 'stock-aging',
    path: '/reports/stock-aging',
    title: 'Stock Aging',
    titleAr: 'تقادم المخزون',
    description: 'Days since last movement and stagnant stock buckets.',
    descriptionAr: 'أيام منذ آخر حركة وتصنيف المخزون الراكد.',
    section: 'inventory',
  },
  {
    id: 'lot-expiry',
    path: '/reports/lot-expiry',
    title: 'Lot Expiry',
    titleAr: 'انتهاء الدفعات',
    description: 'Lot expiry dates and aging buckets for perishable stock.',
    descriptionAr: 'تواريخ انتهاء الدفعات وتصنيف المخزون القابل للتلف.',
    section: 'inventory',
  },
  {
    id: 'capacity-utilization',
    path: '/reports/capacity-utilization',
    title: 'Capacity Utilization',
    titleAr: 'استخدام السعة',
    description: 'Warehouse storage occupancy and per-location utilization.',
    descriptionAr: 'إشغال مواقع التخزين والاستخدام حسب الموقع.',
    section: 'inventory',
  },
  {
    id: 'return-rate',
    path: '/reports/return-rate',
    title: 'Return Rate',
    titleAr: 'معدل الإرجاع',
    description: 'Return orders vs outbound shipments by client.',
    descriptionAr: 'طلبات الإرجاع مقابل الشحنات الصادرة حسب العميل.',
    section: 'inventory',
  },
  {
    id: 'revenue-by-client',
    path: '/reports/revenue-by-client',
    title: 'Revenue by Client',
    titleAr: 'الإيرادات حسب العميل',
    description: 'Issued invoice revenue grouped by client with date and status filters.',
    descriptionAr: 'إيرادات الفواتير الصادرة مجمعة حسب العميل مع فلاتر التاريخ والحالة.',
    section: 'finance',
  },
  {
    id: 'receivables-aging',
    path: '/reports/receivables-aging',
    title: 'Receivables Aging',
    titleAr: 'أعمار الذمم المدينة',
    description: 'Open and overdue invoices bucketed by days past due.',
    descriptionAr: 'الفواتير المفتوحة والمتأخرة مصنفة حسب أيام التأخير.',
    section: 'finance',
  },
  {
    id: 'cod-report',
    path: '/reports/cod-report',
    title: 'COD Report',
    titleAr: 'تقرير الدفع عند الاستلام',
    description: 'COD orders with collection and settlement status.',
    descriptionAr: 'طلبات الدفع عند الاستلام مع حالة التحصيل والتسوية.',
    section: 'oms',
  },
  {
    id: 'merchant-orders',
    path: '/reports/merchant-orders',
    title: 'Merchant Orders',
    titleAr: 'طلبات التجار',
    description: 'OMS merchant orders with payment and allocation status.',
    descriptionAr: 'طلبات التجار مع الدفع وحالة التخصيص.',
    section: 'oms',
  },
  {
    id: 'sales-report',
    path: '/reports/sales-report',
    title: 'Sales Report',
    titleAr: 'تقرير المبيعات',
    description: 'Delivered order revenue by subtotal and shipping.',
    descriptionAr: 'إيرادات الطلبات المسلّمة حسب المجموع والشحن.',
    section: 'oms',
  },
  {
    id: 'returns-report',
    path: '/reports/returns-report',
    title: 'Returns Report',
    titleAr: 'تقرير المرتجعات',
    description: 'Returned OMS orders with recipient and COD details.',
    descriptionAr: 'طلبات OMS المرتجعة مع بيانات المستلم والدفع عند الاستلام.',
    section: 'oms',
  },
  {
    id: 'delivery-report',
    path: '/reports/delivery-report',
    title: 'Delivery Report',
    titleAr: 'تقرير التسليم',
    description: 'Carrier, tracking, and delivery milestones.',
    descriptionAr: 'الناقل والتتبع ومراحل التسليم.',
    section: 'oms',
  },
  {
    id: 'allocation-report',
    path: '/reports/allocation-report',
    title: 'Allocation Report',
    titleAr: 'تقرير التخصيص',
    description: 'Order allocation status and reservation counts.',
    descriptionAr: 'حالة تخصيص الطلبات وعدد الحجوزات.',
    section: 'oms',
  },
  {
    id: 'inventory-reserved',
    path: '/reports/inventory-reserved',
    title: 'Inventory Reserved',
    titleAr: 'المخزون المحجوز',
    description: 'Active stock reservations linked to outbound orders.',
    descriptionAr: 'حجوزات المخزون النشطة المرتبطة بالطلبات الصادرة.',
    section: 'oms',
  },
];

export function getCatalogEntry(id: string): ReportCatalogEntry | undefined {
  return REPORT_CATALOG.find((r) => r.id === id);
}

export const DEFAULT_REPORT_PATH = REPORT_CATALOG[0]!.path;
