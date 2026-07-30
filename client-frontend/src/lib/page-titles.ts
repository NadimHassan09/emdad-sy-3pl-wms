/**
 * Contextual page titles for the Client Portal topbar and document title.
 */

export type PageTitle = { en: string; ar: string };

const TITLES: Array<{ match: (pathname: string) => boolean; title: PageTitle }> = [
  { match: (p) => p === '/dashboard' || p === '/', title: { en: 'Dashboard', ar: 'لوحة التحكم' } },
  { match: (p) => p.startsWith('/inbound-orders/'), title: { en: 'Inbound order', ar: 'طلب وارد' } },
  { match: (p) => p.startsWith('/inbound-orders'), title: { en: 'Inbound orders', ar: 'طلبات الوارد' } },
  { match: (p) => p.startsWith('/outbound-orders/'), title: { en: 'Outbound order', ar: 'طلب صادر' } },
  { match: (p) => p.startsWith('/outbound-orders'), title: { en: 'Outbound orders', ar: 'طلبات الصادر' } },
  { match: (p) => p.startsWith('/ecommerce-orders/'), title: { en: 'Online order', ar: 'طلب إلكتروني' } },
  { match: (p) => p.startsWith('/ecommerce-orders'), title: { en: 'Online orders', ar: 'الطلبات الإلكترونية' } },
  { match: (p) => p.startsWith('/my-profits'), title: { en: 'Cash on delivery', ar: 'الدفع عند الاستلام' } },
  { match: (p) => p.startsWith('/cod-reports'), title: { en: 'Cash on delivery', ar: 'الدفع عند الاستلام' } },
  { match: (p) => p.startsWith('/returns/'), title: { en: 'Return', ar: 'مرتجع' } },
  { match: (p) => p.startsWith('/returns'), title: { en: 'Returns', ar: 'المرتجعات' } },
  { match: (p) => p.startsWith('/products/'), title: { en: 'Product details', ar: 'تفاصيل المنتج' } },
  { match: (p) => p.startsWith('/products'), title: { en: 'Inventory', ar: 'المخزون' } },
  { match: (p) => p.startsWith('/invoices/'), title: { en: 'Invoice', ar: 'فاتورة' } },
  { match: (p) => p.startsWith('/invoices'), title: { en: 'Invoices', ar: 'الفواتير' } },
  { match: (p) => p.startsWith('/billing/invoices/'), title: { en: 'Invoice', ar: 'فاتورة' } },
  { match: (p) => p.startsWith('/billing'), title: { en: 'Billing', ar: 'الفوترة' } },
  { match: (p) => p.startsWith('/notifications'), title: { en: 'Notifications', ar: 'الإشعارات' } },
  { match: (p) => p.startsWith('/profile'), title: { en: 'Profile', ar: 'الملف الشخصي' } },
];

export function resolveClientPageTitle(pathname: string): PageTitle {
  return TITLES.find((t) => t.match(pathname))?.title ?? { en: 'Client Portal', ar: 'بوابة العميل' };
}
