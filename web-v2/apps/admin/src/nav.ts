import {
  ArrowDownToLine, ArrowUpFromLine, Banknote, BarChart3, Boxes, Building2, ChartNoAxesCombined, ClipboardList,
  DatabaseBackup, FileSignature, Layers, LayoutDashboard, ListChecks, MapPin, Package, Receipt, RotateCcw,
  ScanLine, ScrollText, ShoppingCart, Truck, Undo2, Users, Warehouse, Bell, type LucideIcon,
} from 'lucide-react'
import type { NavGroup } from '@emdad/ui'
import { navItemsForRole } from '@/lib/rbac'

const ICONS: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboard,
  Inbound: ArrowDownToLine,
  Outbound: ArrowUpFromLine,
  Inventory: Boxes,
  Tasks: ListChecks,
  'Cycle count': ScanLine,
  Returns: Undo2,
  Products: Package,
  Locations: MapPin,
  Warehouses: Warehouse,
  'OMS Dashboard': ChartNoAxesCombined,
  'OMS Orders': ShoppingCart,
  Batches: Layers,
  COD: Banknote,
  'OMS Returns': RotateCcw,
  Contracts: FileSignature,
  Reports: BarChart3,
  Clients: Building2,
  Forms: ClipboardList,
  Billing: Receipt,
  Users: Users,
  'Audit logs': ScrollText,
  Notifications: Bell,
  Backups: DatabaseBackup,
  'Shipping Companies': Truck,
}

const AR: Record<string, string> = {
  Dashboard: 'لوحة التحكم', Reports: 'التقارير', Orders: 'الطلبات', WMS: 'إدارة المستودع', OMS: 'إدارة الطلبات',
  Inbound: 'الوارد', Outbound: 'الصادر', 'OMS Dashboard': 'لوحة OMS', 'OMS Orders': 'طلبات OMS', Batches: 'المجموعات',
  COD: 'COD', 'OMS Returns': 'مرتجعات OMS', Inventory: 'المخزون', Tasks: 'المهام', 'Cycle count': 'الجرد الدوري',
  Returns: 'الإرجاعات', Products: 'المنتجات', Locations: 'المواقع التخزينية', Warehouses: 'المستودعات',
  Customers: 'العملاء', Clients: 'العملاء', Forms: 'النماذج', Users: 'المستخدمون', 'Audit logs': 'سجل التدقيق',
  Notifications: 'الإشعارات', Settings: 'الإعدادات', Backups: 'النسخ الاحتياطي', 'Shipping Companies': 'شركات الشحن',
  Contracts: 'العقود', Billing: 'الفوترة', Profile: 'الملف الشخصي', 'Sign out': 'تسجيل الخروج', Management: 'الإدارة',
}

export const navLabel = (label: string, isArabic: boolean) => (isArabic ? (AR[label] ?? label) : label)

/** Same RBAC-filtered IA as the classic UI (navItemsForRole), regrouped: Main / WMS / OMS / Management. */
export function buildNavGroups(role: string | undefined, isArabic: boolean): NavGroup[] {
  const items = navItemsForRole(role).map((i) => ({
    key: i.to,
    label: navLabel(i.labelKey, isArabic),
    to: i.to,
    icon: ICONS[i.labelKey] ?? Package,
    group: i.group ?? null,
    isDashboard: i.labelKey === 'Dashboard',
  }))
  const strip = ({ group: _g, isDashboard: _d, ...rest }: (typeof items)[number]) => rest
  const groups: NavGroup[] = [
    { key: 'main', items: items.filter((i) => i.isDashboard).map(strip) },
    { key: 'wms', label: navLabel('WMS', isArabic), items: items.filter((i) => i.group === 'wms').map(strip) },
    { key: 'oms', label: navLabel('OMS', isArabic), items: items.filter((i) => i.group === 'oms').map(strip) },
    { key: 'mgmt', label: navLabel('Management', isArabic), items: items.filter((i) => !i.group && !i.isDashboard).map(strip) },
  ]
  return groups.filter((g) => g.items.length > 0)
}
