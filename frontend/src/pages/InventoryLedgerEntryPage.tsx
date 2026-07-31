import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { AdjustmentsApi } from '../api/adjustments';
import { InboundApi } from '../api/inbound';
import { InventoryApi, type LedgerRow } from '../api/inventory';
import { OutboundApi } from '../api/outbound';
import { Column, DataTable } from '../components/DataTable';
import { QK } from '../constants/query-keys';
import { useDefaultWarehouseId } from '../hooks/useDefaultWarehouse';
import {
  fmtLedgerQty,
  fmtSignedDelta,
  ledgerMovementCategory,
  ledgerMovementLabel,
  ledgerReferenceAdminPath,
  mergeLedgerLinesByLotAndLocation,
  type LedgerMovementCategory,
  type MergedLotLocationLine,
} from '../lib/ledger-display';

function movementTone(cat: LedgerMovementCategory): string {
  switch (cat) {
    case 'inbound':
      return 'text-brand-700';
    case 'outbound':
      return 'text-status-danger-fg';
    default:
      return 'text-text-strong';
  }
}

function movementIcon(cat: LedgerMovementCategory): string {
  switch (cat) {
    case 'inbound':
      return 'fa-solid fa-arrow-down';
    case 'outbound':
      return 'fa-solid fa-arrow-up';
    default:
      return 'fa-solid fa-sliders';
  }
}

function LedgerDetailField({
  iconClass,
  label,
  value,
}: {
  iconClass: string;
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-medium text-text-muted">
        <i className={`${iconClass} text-[11px] text-brand-600/80`} aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className="mt-1.5 text-sm font-semibold text-text-strong">{value}</div>
    </div>
  );
}

function ledgerReferenceIdLabel(
  referenceType: string,
  t: (en: string, ar: string) => string,
): string {
  switch (referenceType) {
    case 'inbound_order':
    case 'outbound_order':
      return t('Order #', 'رقم الطلب');
    case 'adjustment':
      return t('Adjustment ID', 'معرف التعديل');
    default:
      return t('Reference ID', 'معرف المرجع');
  }
}

function LedgerMovementSummaryCard({
  headLine,
  referenceLabel,
  referenceTo,
  t,
}: {
  headLine: LedgerRow;
  referenceLabel: string;
  referenceTo: string | null;
  t: (en: string, ar: string) => string;
}) {
  const category = ledgerMovementCategory(headLine.movementType);
  const movementLabel = ledgerMovementLabel(category);
  const refIdValue =
    referenceTo != null ? (
      <Link
        to={referenceTo}
        className="font-mono text-xs font-semibold text-brand-700 hover:underline"
      >
        {referenceLabel}
      </Link>
    ) : (
      <span className="font-mono text-xs font-semibold">{referenceLabel}</span>
    );

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-border-subtle bg-surface-card p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-surface-card-muted to-surface-card ring-4 ring-surface-card-muted"
          aria-hidden="true"
        >
          <i className={`${movementIcon(category)} text-xl text-text-muted`} />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="text-lg font-semibold leading-tight text-text-strong">
            {t('Movement information', 'معلومات الحركة')}
          </h2>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <LedgerDetailField
          iconClass={movementIcon(category)}
          label={t('Movement type', 'نوع الحركة')}
          value={<span className={movementTone(category)}>{movementLabel}</span>}
        />
        <LedgerDetailField
          iconClass="fa-solid fa-hashtag"
          label={t('Product SKU', 'رمز الصنف')}
          value={<span className="font-mono font-semibold">{headLine.product.sku}</span>}
        />
        <LedgerDetailField
          iconClass="fa-solid fa-fingerprint"
          label={ledgerReferenceIdLabel(headLine.referenceType, t)}
          value={refIdValue}
        />
        <LedgerDetailField
          iconClass="fa-solid fa-tag"
          label={t('Product', 'المنتج')}
          value={headLine.product.name}
        />
        <LedgerDetailField
          iconClass="fa-solid fa-building"
          label={t('Client', 'العميل')}
          value={headLine.company.name}
        />
        <LedgerDetailField
          iconClass="fa-solid fa-clock"
          label={t('When', 'الوقت')}
          value={new Date(headLine.createdAt).toLocaleString()}
        />
        <LedgerDetailField
          iconClass="fa-solid fa-user"
          label={t('Operator', 'المشغّل')}
          value={headLine.operator.fullName}
        />
      </div>
    </section>
  );
}

export function InventoryLedgerEntryPage() {
  const { ledgerId: ledgerIdParam = '', createdAt: createdAtParam = '' } = useParams<{
    ledgerId: string;
    createdAt: string;
  }>();
  const [searchParams] = useSearchParams();
  const companyIdOverride = searchParams.get('companyId')?.trim() || undefined;
  const isArabic =
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (en: string, ar: string) => (isArabic ? ar : en);

  const ledgerId = useMemo(() => {
    try {
      return decodeURIComponent(ledgerIdParam);
    } catch {
      return ledgerIdParam;
    }
  }, [ledgerIdParam]);

  const createdAt = useMemo(() => {
    try {
      return decodeURIComponent(createdAtParam);
    } catch {
      return createdAtParam;
    }
  }, [createdAtParam]);

  const { warehouseId: wid } = useDefaultWarehouseId();

  const query = useQuery({
    queryKey: wid
      ? [...QK.ledgerEntry(wid, ledgerId, createdAt), companyIdOverride ?? 'default-company']
      : ['inventory', 'ledger', 'entry', 'pending'],
    queryFn: () =>
      InventoryApi.ledgerEntry({
        ledgerId,
        createdAt,
        warehouseId: wid || undefined,
        companyIdOverride,
      }),
    enabled: !!wid && !!ledgerId && !!createdAt,
  });

  const headLine = query.data?.lines?.[0];

  const referenceMeta = useQuery({
    queryKey: [
      'ledger-reference-meta',
      headLine?.referenceType,
      headLine?.referenceId,
      companyIdOverride,
    ],
    queryFn: async () => {
      if (!headLine?.referenceId) return { label: '—', to: null as string | null };
      const { referenceType, referenceId } = headLine;
      const to = ledgerReferenceAdminPath(referenceType, referenceId);
      switch (referenceType) {
        case 'inbound_order': {
          const order = await InboundApi.get(referenceId);
          return { label: order.orderNumber || referenceId, to };
        }
        case 'outbound_order': {
          const order = await OutboundApi.get(referenceId);
          return { label: order.orderNumber || referenceId, to };
        }
        case 'adjustment': {
          const adj = await AdjustmentsApi.get(referenceId);
          return { label: adj.id, to };
        }
        default:
          return { label: referenceId, to };
      }
    },
    enabled: !!headLine?.referenceId,
    staleTime: 60_000,
  });

  const mergedRows = useMemo(() => {
    const lines = query.data?.lines ?? [];
    return mergeLedgerLinesByLotAndLocation(lines);
  }, [query.data?.lines]);

  const columns: Column<MergedLotLocationLine>[] = useMemo(
    () => [
      {
        header: t('Lot', 'الدفعة'),
        accessor: (r) => (
          <span className="font-mono text-xs text-text-strong">{r.lotNumber}</span>
        ),
        width: '140px',
      },
      {
        header: t('Location', 'الموقع'),
        accessor: (r) => <span className="text-xs text-text-strong">{r.locationDescription}</span>,
        width: '260px',
      },
      {
        header: t('Δ Qty', 'فرق الكمية'),
        accessor: (r) => {
          const pos = r.delta > 0;
          const neg = r.delta < 0;
          return (
            <span
              className={`font-mono font-semibold ${pos ? 'text-status-success-fg' : neg ? 'text-status-danger-fg' : 'text-text-body'}`}
            >
              {fmtSignedDelta(r.delta)}
            </span>
          );
        },
        width: '100px',
        className: 'text-right',
      },
      {
        header: t('Before', 'قبل'),
        accessor: (r) => (
          <span className="font-mono text-text-body">{fmtLedgerQty(r.before)}</span>
        ),
        width: '100px',
        className: 'text-right',
      },
      {
        header: t('After', 'بعد'),
        accessor: (r) => (
          <span className="font-mono text-text-body">{fmtLedgerQty(r.after)}</span>
        ),
        width: '100px',
        className: 'text-right',
      },
    ],
    [isArabic],
  );

  if (!ledgerId || !createdAt) return null;

  return (
    <>
      <div className="mb-2 text-sm text-text-muted">
        <Link to="/inventory/ledger" className="hover:underline">
          ← {t('Back to ledger', 'العودة إلى السجل')}
        </Link>
      </div>
      {!wid ? (
        <p className="text-sm text-text-body">Resolve warehouse configuration…</p>
      ) : null}

      {query.isError ? (
        <p className="text-sm text-status-danger-fg">Could not load this movement.</p>
      ) : null}

      {headLine ? (
        <LedgerMovementSummaryCard
          headLine={headLine}
          referenceLabel={referenceMeta.data?.label ?? headLine.referenceId}
          referenceTo={referenceMeta.data?.to ?? ledgerReferenceAdminPath(headLine.referenceType, headLine.referenceId)}
          t={t}
        />
      ) : null}

      <DataTable
        title={t('Movement detail', 'تفاصيل الحركة')}
        columns={columns}
        rows={mergedRows}
        rowKey={(r) => r.key}
        loading={query.isLoading || !wid}
        empty={
          wid
            ? t('No lot/location lines for this movement.', 'لا توجد بنود دفعة/موقع لهذه الحركة.')
            : t('Warehouse not resolved yet.', 'لم يُحدد المستودع بعد.')
        }
        labels={{
          rowsSuffix: t('rows', 'صف'),
          resultsSuffix: t('results', 'نتيجة'),
          ofWord: t('of', 'من'),
          previous: t('Previous', 'السابق'),
          next: t('Next', 'التالي'),
          rowsPerPageAria: t('Rows per page', 'عدد الصفوف لكل صفحة'),
        }}
      />
    </>
  );
}
