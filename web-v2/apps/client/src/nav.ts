import { ArrowDownToLine, ArrowUpFromLine, Banknote, Bell, Boxes, FileText, KeyRound, LayoutDashboard, Receipt, RotateCcw, ShoppingCart, type LucideIcon } from 'lucide-react'
import type { NavGroup } from '@emdad/ui'
import { clientNavForRole } from '@/lib/rbac'

const ICONS: Record<string, LucideIcon> = {
  '/dashboard': LayoutDashboard,
  '/ecommerce-orders': ShoppingCart,
  '/my-profits': Banknote,
  '/ecommerce-orders/returns': RotateCcw,
  '/inbound-orders': ArrowDownToLine,
  '/outbound-orders': ArrowUpFromLine,
  '/products': Boxes,
  '/apis': KeyRound,
  '/billing': Receipt,
  '/invoices': FileText,
  '/notifications': Bell,
}

/** Same RBAC-filtered IA as the classic portal, regrouped: Home / OMS / WMS / Account. */
export function buildClientNavGroups(role: string | undefined, isArabic: boolean, unread: number): NavGroup[] {
  const items = clientNavForRole(role).map((i) => ({
    key: i.to,
    label: isArabic ? i.labelAr : i.label,
    to: i.to,
    icon: ICONS[i.to] ?? Boxes,
    end: i.exact,
    group: i.group ?? null,
    badge: i.to === '/notifications' && unread > 0 ? unread : undefined,
  }))
  const strip = ({ group: _g, ...rest }: (typeof items)[number]) => rest
  const groups: NavGroup[] = [
    { key: 'main', items: items.filter((i) => i.to === '/dashboard').map(strip) },
    { key: 'oms', label: 'OMS', items: items.filter((i) => i.group === 'oms').map(strip) },
    { key: 'wms', label: 'WMS', items: items.filter((i) => i.group === 'wms').map(strip) },
    { key: 'account', label: isArabic ? 'الحساب' : 'Account', items: items.filter((i) => !i.group && i.to !== '/dashboard').map(strip) },
  ]
  return groups.filter((g) => g.items.length > 0)
}
