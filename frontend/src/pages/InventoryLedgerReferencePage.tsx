import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';

import { InventoryApi, LedgerRow } from '../api/inventory';
import { Column, DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { QK } from '../constants/query-keys';
import { useDefaultWarehouseId } from '../hooks/useDefaultWarehouse';
import {
  fmtLedgerQty,
  fmtSignedDelta,
  ledgerMovementCategory,
  ledgerMovementLabel,
  ledgerQuantityDisplay,
} from '../lib/ledger-display';

function locationCell(row: LedgerRow): string {
  if (row.locationLabel) return row.locationLabel;
  const parts: string[] = [];
  if (row.fromLocationId) parts.push(`from ${row.fromLocationId.slice(0, 8)}…`);
  if (row.toLocationId) parts.push(`to ${row.toLocationId.slice(0, 8)}…`);
  if (row.locationId) parts.push(row.locationId.slice(0, 8) + '…');
  return parts.length ? parts.join(' · ') : '—';
}

export function InventoryLedgerReferencePage() {
  const { referenceType: refTypeParam = '', referenceId: refIdParam = '' } = useParams<{
    referenceType: string;
    referenceId: string;
  }>();

  const referenceType = useMemo(() => {
    try {
      return decodeURIComponent(refTypeParam);
    } catch {
      return refTypeParam;
    }
  }, [refTypeParam]);

  const referenceId = useMemo(() => {
    try {
      return decodeURIComponent(refIdParam);
    } catch {
      return refIdParam;
    }
  }, [refIdParam]);

  const { warehouseId: wid } = useDefaultWarehouseId();

  const ledger = useQuery({
    queryKey: wid ? QK.ledgerDetail(wid, referenceType, referenceId) : ['inventory', 'ledger', 'detail', 'pending'],
    queryFn: () =>
      InventoryApi.ledger({
        warehouseId: wid!,
        referenceType,
        referenceId,
        limit: 500,
      }),
    enabled: !!wid && !!referenceType && !!referenceId,
  });

  const rows = useMemo(() => {
    const items = ledger.data?.items ?? [];
    const narrowed = items.filter(
      (r) => r.referenceType === referenceType && r.referenceId === referenceId,
    );
    return narrowed.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [ledger.data?.items, referenceType, referenceId]);

  const columns: Column<LedgerRow>[] = useMemo(
    () => [
      {
        header: 'Product',
        accessor: (r) => (
          <div>
            <div className="font-medium text-slate-900">{r.product.name}</div>
            <div className="font-mono text-xs text-slate-500">{r.product.sku}</div>
          </div>
        ),
      },
      {
        header: 'Client',
        accessor: (r) => r.company.name,
        width: '140px',
      },
      {
        header: 'Movement',
        accessor: (r) => {
          const cat = ledgerMovementCategory(r.movementType);
          const tone =
            cat === 'inbound'
              ? 'bg-emerald-50 text-emerald-900 ring-emerald-200'
              : cat === 'outbound'
                ? 'bg-rose-50 text-rose-900 ring-rose-200'
                : 'bg-slate-100 text-slate-800 ring-slate-200';
          return (
            <div className="space-y-1">
              <span
                className={`inline-block rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tone}`}
              >
                {ledgerMovementLabel(cat)}
              </span>
              <div className="font-mono text-[11px] text-slate-500" title={r.movementType}>
                {r.movementType}
              </div>
            </div>
          );
        },
        width: '140px',
      },
      {
        header: 'Location',
        accessor: (r) => <span className="text-xs text-slate-800">{locationCell(r)}</span>,
        width: '220px',
      },
      {
        header: 'Lot',
        accessor: (r) => (
          <span className="font-mono text-xs text-slate-700">{r.lot?.lotNumber ?? '—'}</span>
        ),
        width: '120px',
      },
      {
        header: 'Δ Qty',
        accessor: (r) => {
          const { delta } = ledgerQuantityDisplay(r);
          const pos = delta > 0;
          const neg = delta < 0;
          return (
            <span
              className={`font-mono font-semibold ${pos ? 'text-emerald-600' : neg ? 'text-rose-600' : 'text-slate-600'}`}
            >
              {fmtSignedDelta(delta)}
            </span>
          );
        },
        width: '90px',
        className: 'text-right',
      },
      {
        header: 'Before',
        accessor: (r) => {
          const { before } = ledgerQuantityDisplay(r);
          return <span className="font-mono text-slate-700">{fmtLedgerQty(before)}</span>;
        },
        width: '90px',
        className: 'text-right',
      },
      {
        header: 'After',
        accessor: (r) => {
          const { after } = ledgerQuantityDisplay(r);
          return <span className="font-mono text-slate-700">{fmtLedgerQty(after)}</span>;
        },
        width: '90px',
        className: 'text-right',
      },
      {
        header: 'When',
        accessor: (r) => new Date(r.createdAt).toLocaleString(),
        width: '160px',
      },
      {
        header: 'Operator',
        accessor: (r) => r.operator.fullName,
        width: '140px',
      },
    ],
    [],
  );

  if (!referenceType || !referenceId) return null;

  return (
    <>
      <div className="mb-2 text-sm text-slate-500">
        <Link to="/inventory/ledger" className="hover:underline">
          ← Back to ledger
        </Link>
      </div>
      <PageHeader
        title="Ledger movement detail"
        description={`${referenceType} · ${referenceId}${ledger.data?.total != null ? ` · ${rows.length} line(s)` : ''}`}
      />

      {!wid ? (
        <p className="text-sm text-slate-600">Resolve warehouse configuration…</p>
      ) : null}

      {ledger.isError ? (
        <p className="text-sm text-rose-600">Could not load ledger lines for this reference.</p>
      ) : null}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={ledger.isLoading || !wid}
        empty={wid ? 'No ledger lines for this reference in the current warehouse.' : 'Warehouse not resolved yet.'}
      />

      {rows.length > 0 && ledger.data && rows.length < ledger.data.total ? (
        <p className="mt-2 text-xs text-amber-700">
          Showing first {rows.length} of {ledger.data.total} line(s). Increase limit if the API allows.
        </p>
      ) : null}
    </>
  );
}
