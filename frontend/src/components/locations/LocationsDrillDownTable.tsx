import { useEffect, useMemo, useState } from 'react';

import type { Location } from '../../api/locations';
import { locationTypePillClass, locationTypeShowsStockContents } from '../../lib/location-types';
import {
  dataTablePaginationLabels,
  localizedLocationStatusLabel,
  localizedLocationTypeHint,
  localizedLocationTypeLabel,
} from '../../lib/ui-labels/locations';
import { useWmsTranslation } from '../../lib/ui-i18n';
import { AnchoredDropdown } from '../AnchoredDropdown';
import { Column, DataTable } from '../DataTable';

function LocationStatusPill({ status }: { status: string }) {
  const { t } = useWmsTranslation();
  const cls =
    status === 'active'
      ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
      : status === 'blocked'
        ? 'bg-amber-50 text-amber-900 ring-amber-200'
        : status === 'archived'
          ? 'bg-slate-100 text-slate-600 ring-slate-200'
          : 'bg-slate-50 text-slate-600 ring-slate-200';
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${cls}`}
    >
      {localizedLocationStatusLabel(status, t)}
    </span>
  );
}

function formatChildLabel(name: string, childCount: number): string {
  if (childCount <= 0) return name;
  return `${name} (${childCount.toLocaleString()})`;
}

export function LocationsDrillDownTable({
  rows,
  loading,
  serverPagination,
  purgeReady,
  blockDeleteSet,
  onNavigateInto,
  onEdit,
  onBarcodeClick,
  onStockClick,
  onSuspend,
  onUnsuspend,
  onRequestPermanentDelete,
  actionBusy,
}: {
  rows: Location[];
  loading: boolean;
  serverPagination: {
    total: number;
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
    pageSizeOptions?: number[];
  };
  purgeReady: boolean;
  blockDeleteSet: Set<string>;
  onNavigateInto: (row: Location) => void;
  onEdit: (row: Location) => void;
  onBarcodeClick: (barcode: string, contextLabel: string) => void;
  onStockClick: (row: Location) => void;
  onSuspend: (id: string) => void;
  onUnsuspend: (id: string) => void;
  onRequestPermanentDelete: (row: Location) => void;
  actionBusy: boolean;
}) {
  const { t } = useWmsTranslation();
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const paginationLabels = useMemo(() => dataTablePaginationLabels(t), [t]);

  useEffect(() => {
    if (!openActionId) return;
    const onPointerDown = (ev: PointerEvent) => {
      const target = ev.target as Element | null;
      if (!target) return;
      if (
        target.closest('[data-location-action-trigger="true"]') ||
        target.closest('[data-location-action-menu="true"]')
      ) {
        return;
      }
      setOpenActionId(null);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [openActionId]);

  const columns: Column<Location>[] = useMemo(
    () => [
      {
        header: '',
        width: '44px',
        accessor: (r) =>
          (r.childCount ?? 0) > 0 ? (
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-md text-[#1a7a44] transition hover:bg-emerald-50"
              aria-label={`${t(['Open children of', 'فتح أبناء'])} ${r.name}`}
              title={t(['View children', 'عرض الأبناء'])}
              onClick={(e) => {
                e.stopPropagation();
                onNavigateInto(r);
              }}
            >
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 4 13 10 7 16" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            <span className="inline-block h-8 w-8" aria-hidden />
          ),
      },
      {
        header: t(['Location', 'الموقع']),
        accessor: (r) => (
          <button
            type="button"
            className="text-left font-medium text-slate-900 hover:text-[#1a7a44] hover:underline"
            onClick={() => (r.childCount ?? 0) > 0 && onNavigateInto(r)}
          >
            {formatChildLabel(r.name, r.childCount ?? 0)}
          </button>
        ),
      },
      {
        header: t(['Type', 'النوع']),
        width: '120px',
        accessor: (r) => (
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${locationTypePillClass(r.type)}`}
            title={localizedLocationTypeHint(r.type, t)}
          >
            {localizedLocationTypeLabel(r.type, t)}
          </span>
        ),
      },
      {
        header: 'Location Code',
        accessor: (r) => (
          <span className="max-w-[14rem] truncate font-mono text-xs text-slate-600" title={r.fullPath}>
            {r.fullPath}
          </span>
        ),
      },
      {
        header: 'Barcode',
        width: '160px',
        accessor: (r) => <span className="font-mono text-xs">{r.barcode}</span>,
      },
      {
        header: t(['Status', 'الحالة']),
        width: '110px',
        accessor: (r) => <LocationStatusPill status={r.status} />,
      },
      {
        header: t(['Capacity', 'السعة']),
        width: '120px',
        className: 'hidden lg:table-cell',
        accessor: (r) => {
          const parts = [
            r.maxWeightKg != null && r.maxWeightKg !== '' ? `${r.maxWeightKg} kg` : null,
            r.maxCbm != null && r.maxCbm !== '' ? `${r.maxCbm} m³` : null,
          ].filter(Boolean);
          return parts.length ? parts.join(' · ') : '—';
        },
      },
      {
        header: '',
        width: '72px',
        className: 'text-right',
        accessor: (r) => {
          const menuOpen = openActionId === r.id;
          const canPermanentDelete =
            purgeReady && r.status !== 'archived' && !blockDeleteSet.has(r.id);
          return (
            <div className="inline-flex justify-end" onClick={(e) => e.stopPropagation()}>
              <AnchoredDropdown
                open={menuOpen}
                align="end"
                menuRootProps={{ 'data-location-action-menu': 'true' }}
                trigger={
                  <button
                    type="button"
                    aria-expanded={menuOpen}
                    aria-haspopup="menu"
                    aria-label={t(['Location actions', 'إجراءات الموقع'])}
                    disabled={actionBusy}
                    data-location-action-trigger="true"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 disabled:opacity-40"
                    onClick={() => setOpenActionId(menuOpen ? null : r.id)}
                  >
                    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden>
                      <path d="M4 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm4.5 0a1.5 1.5 0 1 1 3.001 0A1.5 1.5 0 0 1 8.5 10ZM13 10a1.5 1.5 0 1 1 3.001 0A1.5 1.5 0 0 1 13 10Z" />
                    </svg>
                  </button>
                }
              >
                <button
                  type="button"
                  className="flex w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setOpenActionId(null);
                    onBarcodeClick(r.barcode, r.fullPath);
                  }}
                >
                  {t(['Barcode image', 'صورة Barcode'])}
                </button>
                {locationTypeShowsStockContents(r.type) ? (
                  <button
                    type="button"
                    className="flex w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      setOpenActionId(null);
                      onStockClick(r);
                    }}
                  >
                    {t(['Current stock', 'المخزون الحالي'])}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="flex w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setOpenActionId(null);
                    onEdit(r);
                  }}
                >
                  {t(['Edit location', 'تعديل الموقع'])}
                </button>
                {r.status === 'active' ? (
                  <button
                    type="button"
                    className="flex w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      setOpenActionId(null);
                      onSuspend(r.id);
                    }}
                  >
                    {t(['Suspend', 'إيقاف'])}
                  </button>
                ) : null}
                {r.status === 'blocked' ? (
                  <button
                    type="button"
                    className="flex w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      setOpenActionId(null);
                      onUnsuspend(r.id);
                    }}
                  >
                    {t(['Unsuspend', 'إلغاء الإيقاف'])}
                  </button>
                ) : null}
                {canPermanentDelete ? (
                  <button
                    type="button"
                    className="flex w-full px-3 py-2 text-left text-sm text-rose-800 hover:bg-rose-50"
                    onClick={() => {
                      setOpenActionId(null);
                      onRequestPermanentDelete(r);
                    }}
                  >
                    {t(['Delete permanently', 'حذف نهائي'])}
                  </button>
                ) : null}
              </AnchoredDropdown>
            </div>
          );
        },
      },
    ],
    [
      t,
      openActionId,
      purgeReady,
      blockDeleteSet,
      actionBusy,
      onNavigateInto,
      onEdit,
      onBarcodeClick,
      onStockClick,
      onSuspend,
      onUnsuspend,
      onRequestPermanentDelete,
    ],
  );

  return (
    <DataTable
      title={t(['Locations', 'المواقع التخزينية'])}
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      loading={loading}
      empty={t(['No locations at this level match the filters.', 'لا توجد مواقع في هذا المستوى مطابقة للفلاتر.'])}
      serverPagination={serverPagination}
      labels={paginationLabels}
    />
  );
}
