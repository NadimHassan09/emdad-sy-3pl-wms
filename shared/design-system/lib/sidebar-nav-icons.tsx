import type { ReactNode } from 'react';
import { cn } from '../ui/cn';

/** Font Awesome class names for admin WMS sidebar (`labelKey` from rbac). */
export const ADMIN_NAV_ICONS: Record<string, string> = {
  Dashboard: 'fa-solid fa-table-cells-large',
  Orders: 'fa-solid fa-arrow-right-arrow-left',
  Inventory: 'fa-solid fa-boxes-stacked',
  Tasks: 'fa-solid fa-list-check',
  Products: 'fa-solid fa-box-open',
  Locations: 'fa-solid fa-location-dot',
  Warehouses: 'fa-solid fa-warehouse',
  Reports: 'fa-solid fa-chart-simple',
  Customers: 'fa-solid fa-users',
    Users: 'fa-solid fa-user-gear',
  AuditLogs: 'fa-solid fa-clock-rotate-left',
  Settings: 'fa-solid fa-gear',
};

/** Font Awesome class names for client portal sidebar (English label key). */
export const CLIENT_NAV_ICONS: Record<string, string> = {
  Home: 'fa-solid fa-house',
  Dashboard: 'fa-solid fa-table-cells-large',
  Orders: 'fa-solid fa-clipboard-list',
  Products: 'fa-solid fa-cube',
  Stock: 'fa-solid fa-warehouse',
  Billing: 'fa-solid fa-file-invoice-dollar',
  Notifications: 'fa-regular fa-bell',
};

export function renderSidebarNavIcon(iconKey: string): ReactNode {
  const faClass =
    ADMIN_NAV_ICONS[iconKey] ?? CLIENT_NAV_ICONS[iconKey] ?? 'fa-solid fa-circle';
  return (
    <i
      className={cn(faClass, 'inline-block w-[18px] text-center text-[15px] leading-none')}
      aria-hidden="true"
    />
  );
}
