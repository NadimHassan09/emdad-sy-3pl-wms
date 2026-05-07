import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { CompaniesApi } from '../api/companies';
import { InventoryApi, LedgerRow } from '../api/inventory';
import { ProductsApi } from '../api/products';
import { Combobox } from '../components/Combobox';
import { Column, DataTable } from '../components/DataTable';
import { FilterActions } from '../components/FilterActions';
import { PageHeader } from '../components/PageHeader';
import { TextField } from '../components/TextField';
import { QK } from '../constants/query-keys';
import { useDefaultWarehouseId } from '../hooks/useDefaultWarehouse';
import { useFilters } from '../hooks/useFilters';
import {
  fmtLedgerQty,
  fmtSignedDelta,
  ledgerEntryDetailPath,
  ledgerGroupRefLabel,
  ledgerMovementCategory,
  ledgerMovementLabel,
  ledgerQuantityDisplay,
  type LedgerMovementCategory,
} from '../lib/ledger-display';

type LedgerDraft = {
  productId: string;
  movementCategory: '' | LedgerMovementCategory;
  companyId: string;
  createdFrom: string;
  createdTo: string;
};

function ledgerRowKey(r: LedgerRow): string {
  return `${r.id}:${r.createdAt}`;
}

export function InventoryLedgerPage() {
  const navigate = useNavigate();
  const { warehouseId: wid } = useDefaultWarehouseId();
  const initial = useMemo<LedgerDraft>(
    () => ({
      productId: '',
      movementCategory: '',
      companyId: '',
      createdFrom: '',
      createdTo: '',
    }),
    [],
  );

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters(initial);

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    staleTime: 10 * 60_000,
  });

  const products = useQuery({
    queryKey: [...QK.products, 'ledger-dropdown'],
    queryFn: () => ProductsApi.list({ limit: 500 }),
    staleTime: 15 * 60_000,
  });

  const ledgerParams = useMemo(
    () => ({
      warehouseId: wid || undefined,
      productId: appliedFilters.productId || undefined,
      companyId: appliedFilters.companyId || undefined,
      createdFrom: appliedFilters.createdFrom.trim() || undefined,
      createdTo: appliedFilters.createdTo.trim() || undefined,
    }),
    [appliedFilters, wid],
  );

  const ledger = useQuery({
    queryKey: [...QK.ledger, ledgerParams],
    queryFn: () => InventoryApi.ledger({ limit: 500, ...ledgerParams }),
    enabled: !!wid,
  });

  const ledgerRows = useMemo(() => {
    const items = ledger.data?.items ?? [];
    const cat = appliedFilters.movementCategory;
    if (!cat) return items;
    return items.filter((r) => ledgerMovementCategory(r.movementType) === cat);
  }, [ledger.data?.items, appliedFilters.movementCategory]);

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
            <div className="space-y-0.5">
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
        width: '130px',
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
        width: '100px',
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
        header: 'Ref',
        accessor: (r) => (
          <span className="text-xs font-mono text-slate-500">
            {ledgerGroupRefLabel(r.referenceType, r.referenceId)}
          </span>
        ),
        width: '200px',
      },
      {
        header: 'When',
        accessor: (r) => new Date(r.createdAt).toLocaleString(),
        width: '160px',
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="Inventory ledger"
        description="Each row is one stock movement. Δ = after − before for that lot/location. Open a row for lot/location breakdown (deduplicated)."
      />

      {!wid ? (
        <p className="text-sm text-slate-600">Resolve warehouse configuration…</p>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-3">
        <Combobox
          label="Client"
          value={draftFilters.companyId}
          onChange={(v) => setDraft({ companyId: v })}
          options={(companies.data ?? []).map((c) => ({
            value: c.id,
            label: c.name,
          }))}
          placeholder="All clients"
          className="min-w-[240px]"
        />
        <Combobox
          label="Product"
          value={draftFilters.productId}
          onChange={(v) => setDraft({ productId: v })}
          options={(products.data?.items ?? []).map((p) => ({
            value: p.id,
            label: `${p.sku} — ${p.name}`,
          }))}
          placeholder="All products"
          className="min-w-[280px]"
        />
        <Combobox
          label="Movement"
          value={draftFilters.movementCategory}
          onChange={(v) =>
            setDraft({ movementCategory: (v || '') as LedgerDraft['movementCategory'] })
          }
          options={[
            { value: '', label: 'All movements' },
            { value: 'inbound', label: 'Inbound' },
            { value: 'outbound', label: 'Outbound' },
            { value: 'adjustment', label: 'Adjustment' },
          ]}
          placeholder="Category…"
          className="min-w-[200px]"
        />
        <TextField
          label="Created from"
          type="date"
          value={draftFilters.createdFrom}
          onChange={(e) => setDraft({ createdFrom: e.target.value })}
          className="min-w-[180px]"
        />
        <TextField
          label="Created to"
          type="date"
          value={draftFilters.createdTo}
          onChange={(e) => setDraft({ createdTo: e.target.value })}
          className="min-w-[180px]"
        />
      </div>
      <FilterActions onApply={applyFilters} onReset={resetFilters} loading={ledger.isFetching} />

      <DataTable
        columns={columns}
        rows={ledgerRows}
        rowKey={ledgerRowKey}
        loading={ledger.isLoading || !wid}
        empty={wid ? 'No ledger rows for the current filters.' : 'Warehouse not resolved yet.'}
        onRowClick={(r) => navigate(ledgerEntryDetailPath(r.id, r.createdAt))}
      />
      <p className="mt-2 text-xs text-slate-500">
        {ledger.data
          ? appliedFilters.movementCategory
            ? `Showing ${ledgerRows.length} movement(s) · ${ledger.data.total} line(s) from server`
            : `${ledgerRows.length} movement(s) · ${ledger.data.total} line(s) from server`
          : ''}
      </p>
    </>
  );
}
