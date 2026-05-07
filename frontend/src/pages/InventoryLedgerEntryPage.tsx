import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';

import { InventoryApi } from '../api/inventory';
import { Column, DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { QK } from '../constants/query-keys';
import { useDefaultWarehouseId } from '../hooks/useDefaultWarehouse';
import {
  fmtLedgerQty,
  fmtSignedDelta,
  ledgerMovementCategory,
  ledgerMovementLabel,
  mergeLedgerLinesByLotAndLocation,
  type MergedLotLocationLine,
} from '../lib/ledger-display';

export function InventoryLedgerEntryPage() {
  const { ledgerId: ledgerIdParam = '', createdAt: createdAtParam = '' } = useParams<{
    ledgerId: string;
    createdAt: string;
  }>();

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
    queryKey: wid ? QK.ledgerEntry(wid, ledgerId, createdAt) : ['inventory', 'ledger', 'entry', 'pending'],
    queryFn: () =>
      InventoryApi.ledgerEntry({
        ledgerId,
        createdAt,
        warehouseId: wid || undefined,
      }),
    enabled: !!wid && !!ledgerId && !!createdAt,
  });

  const headLine = query.data?.lines?.[0];

  const mergedRows = useMemo(() => {
    const lines = query.data?.lines ?? [];
    return mergeLedgerLinesByLotAndLocation(lines);
  }, [query.data?.lines]);

  const movementSummary = headLine
    ? ledgerMovementLabel(ledgerMovementCategory(headLine.movementType))
    : '';

  const columns: Column<MergedLotLocationLine>[] = useMemo(
    () => [
      {
        header: 'Lot',
        accessor: (r) => (
          <span className="font-mono text-xs text-slate-800">{r.lotNumber}</span>
        ),
        width: '140px',
      },
      {
        header: 'Location',
        accessor: (r) => <span className="text-xs text-slate-800">{r.locationDescription}</span>,
        width: '260px',
      },
      {
        header: 'Δ Qty',
        accessor: (r) => {
          const pos = r.delta > 0;
          const neg = r.delta < 0;
          return (
            <span
              className={`font-mono font-semibold ${pos ? 'text-emerald-600' : neg ? 'text-rose-600' : 'text-slate-600'}`}
            >
              {fmtSignedDelta(r.delta)}
            </span>
          );
        },
        width: '100px',
        className: 'text-right',
      },
      {
        header: 'Before',
        accessor: (r) => (
          <span className="font-mono text-slate-700">{fmtLedgerQty(r.before)}</span>
        ),
        width: '100px',
        className: 'text-right',
      },
      {
        header: 'After',
        accessor: (r) => (
          <span className="font-mono text-slate-700">{fmtLedgerQty(r.after)}</span>
        ),
        width: '100px',
        className: 'text-right',
      },
    ],
    [],
  );

  if (!ledgerId || !createdAt) return null;

  return (
    <>
      <div className="mb-2 text-sm text-slate-500">
        <Link to="/inventory/ledger" className="hover:underline">
          ← Back to ledger
        </Link>
      </div>
      <PageHeader
        title="Movement detail"
        description={
          headLine
            ? `${headLine.product.name} (${headLine.product.sku}) · ${movementSummary} · ${headLine.referenceType} · ${headLine.referenceId.slice(0, 8)}…`
            : '—'
        }
      />

      {!wid ? (
        <p className="text-sm text-slate-600">Resolve warehouse configuration…</p>
      ) : null}

      {query.isError ? (
        <p className="text-sm text-rose-600">Could not load this movement.</p>
      ) : null}

      {headLine ? (
        <div className="mb-4 rounded-md border border-slate-200 bg-white p-4 text-sm shadow-sm">
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Client</div>
              <div className="font-medium text-slate-900">{headLine.company.name}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Movement type</div>
              <div className="font-mono text-slate-800">{headLine.movementType}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">When</div>
              <div>{new Date(headLine.createdAt).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Operator</div>
              <div>{headLine.operator.fullName}</div>
            </div>
          </div>
        </div>
      ) : null}

      <h3 className="mb-2 text-sm font-semibold text-slate-800">By lot & location</h3>
      <DataTable
        columns={columns}
        rows={mergedRows}
        rowKey={(r) => r.key}
        loading={query.isLoading || !wid}
        empty={wid ? 'No lot/location lines for this movement.' : 'Warehouse not resolved yet.'}
      />
    </>
  );
}
