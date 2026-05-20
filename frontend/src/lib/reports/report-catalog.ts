export type ReportCatalogId = 'warehouse-analysis' | 'inventory' | 'product-moves';

export type ReportCatalogEntry = {
  id: ReportCatalogId;
  path: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
};

export const REPORT_CATALOG: ReportCatalogEntry[] = [
  {
    id: 'warehouse-analysis',
    path: '/reports/warehouse-analysis',
    title: 'Warehouse Analysis',
    titleAr: 'تحليل المستودع',
    description: 'Throughput, cycle times, and delays for client fulfillment.',
    descriptionAr: 'الإنتاجية وأوقات الدورة والتأخيرات.',
  },
  {
    id: 'inventory',
    path: '/reports/inventory',
    title: 'Inventory',
    titleAr: 'المخزون',
    description: 'Client-owned stock by product, location, and lot.',
    descriptionAr: 'مخزون العملاء حسب المنتج والموقع.',
  },
  {
    id: 'product-moves',
    path: '/reports/product-moves',
    title: 'Product Moves',
    titleAr: 'حركات المنتجات',
    description: 'Stock movements with reference and operator.',
    descriptionAr: 'حركات المخزون مع المرجع والمشغّل.',
  },
];

export function getCatalogEntry(id: string): ReportCatalogEntry | undefined {
  return REPORT_CATALOG.find((r) => r.id === id);
}

export const DEFAULT_REPORT_PATH = REPORT_CATALOG[0]!.path;
