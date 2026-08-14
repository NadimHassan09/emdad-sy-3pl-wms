import type { LucideIcon } from 'lucide-react';
import {
  FileText,
  MoreHorizontal,
  PackageOpen,
  Receipt,
  Truck,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@ds';

import { dashboardLabel } from './dashboard-i18n';
import { DashboardWidget } from './DashboardWidget';

type Action = {
  key: string;
  label: string;
  icon: LucideIcon;
  to: string;
  tone: string;
};

export function QuickActions({
  isArabic,
  canClients,
  canBilling,
  canProducts,
  canWarehouses,
}: {
  isArabic: boolean;
  canClients: boolean;
  canBilling: boolean;
  canProducts: boolean;
  canWarehouses: boolean;
}) {
  const t = (s: string) => dashboardLabel(s, isArabic);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    function onDoc(e: MouseEvent) {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [moreOpen]);

  const primary: Action[] = [
    canClients
      ? { key: 'client', label: t('New Client'), icon: Users, to: '/clients?create=1', tone: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400' }
      : null,
    { key: 'inbound', label: t('New Inbound'), icon: PackageOpen, to: '/orders/inbound/new', tone: 'bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-400' },
    { key: 'outbound', label: t('New Outbound'), icon: Truck, to: '/orders/outbound/new', tone: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' },
    canBilling
      ? { key: 'invoice', label: t('Create Invoice'), icon: Receipt, to: '/billing/invoices', tone: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400' }
      : null,
    { key: 'contract', label: t('New Contract'), icon: FileText, to: '/contracts/grn', tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' },
  ].filter(Boolean) as Action[];

  const more: Array<{ label: string; to: string }> = [
    canProducts ? { label: t('Products'), to: '/products' } : null,
    canWarehouses ? { label: t('Warehouses'), to: '/warehouses' } : null,
    canBilling ? { label: t('Billing'), to: '/billing/plans' } : null,
    { label: t('Reports'), to: '/reports' },
    { label: t('Inventory'), to: '/inventory/stock' },
  ].filter(Boolean) as Array<{ label: string; to: string }>;

  const tiles = [...primary.slice(0, 5)];

  return (
    <DashboardWidget title={t('Quick Actions')}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.key}
              to={action.to}
              className={cn(
                'group flex flex-col items-center justify-center gap-2 rounded-[10px] border border-transparent bg-surface-sunken px-2 py-3 text-center',
                'transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:bg-surface-panel hover:shadow-sm',
              )}
            >
              <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', action.tone)}>
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <span className="text-[11px] font-semibold leading-tight text-text-body">{action.label}</span>
            </Link>
          );
        })}

        <div className="relative" ref={moreRef}>
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              'flex h-full min-h-[88px] w-full flex-col items-center justify-center gap-2 rounded-[10px] border border-transparent bg-surface-sunken px-2 py-3',
              'transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:bg-surface-panel hover:shadow-sm',
            )}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 text-text-muted dark:bg-white/5">
              <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <span className="text-[11px] font-semibold leading-tight text-text-body">{t('More Actions')}</span>
          </button>
          {moreOpen ? (
            <div className="absolute end-0 z-20 mt-1 min-w-[10rem] overflow-hidden rounded-[10px] border border-border bg-surface-panel py-1 shadow-md">
              {more.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className="block px-3 py-2 text-xs font-medium text-text-body hover:bg-surface-hover"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </DashboardWidget>
  );
}
