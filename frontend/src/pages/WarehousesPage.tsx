import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import {
  CreateWarehouseInput,
  UpdateWarehouseInput,
  Warehouse,
  WarehouseStatus,
  WarehousesApi,
} from '../api/warehouses';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { ConfirmModal } from '../components/ConfirmModal';
import { Column, DataTable } from '../components/DataTable';
import { FilterPanel } from '../components/FilterPanel';
import { Modal } from '../components/Modal';
import { SelectField } from '../components/SelectField';
import { TextField } from '../components/TextField';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import { useFilters } from '../hooks/useFilters';
import { COUNTRIES, OTHER_COUNTRY } from '../lib/geography';
import { AppPageHeader } from '@ds';

type StatusFilter = '' | WarehouseStatus;

type ListFilters = {
  search: string;
  status: StatusFilter;
  includeInactive: boolean;
};

const INITIAL_FILTERS: ListFilters = {
  search: '',
  status: '',
  includeInactive: false,
};

function filterWarehouses(rows: Warehouse[], filters: ListFilters): Warehouse[] {
  const q = filters.search.trim().toLowerCase();
  return rows.filter((w) => {
    if (filters.status && w.status !== filters.status) return false;
    if (!q) return true;
    return (
      w.code.toLowerCase().includes(q) ||
      w.name.toLowerCase().includes(q) ||
      (w.city?.toLowerCase().includes(q) ?? false) ||
      w.country.toLowerCase().includes(q)
    );
  });
}

export function WarehousesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const canMutate = user?.role === 'super_admin' || user?.role === 'wh_manager';

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters<ListFilters>(INITIAL_FILTERS);

  const [openCreate, setOpenCreate] = useState(false);
  const [editWh, setEditWh] = useState<Warehouse | null>(null);
  const [deactivateWh, setDeactivateWh] = useState<Warehouse | null>(null);

  const listKey = useMemo(
    () => [...QK.warehouses, appliedFilters.includeInactive] as const,
    [appliedFilters.includeInactive],
  );

  const list = useQuery({
    queryKey: listKey,
    queryFn: () => WarehousesApi.list(appliedFilters.includeInactive),
  });

  const filteredRows = useMemo(
    () => filterWarehouses(list.data ?? [], appliedFilters),
    [list.data, appliedFilters],
  );

  const createMut = useMutation({
    mutationFn: WarehousesApi.create,
    onSuccess: () => {
      toast.success('Warehouse created.');
      qc.invalidateQueries({ queryKey: QK.warehouses });
      setOpenCreate(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: WarehouseStatus }) =>
      WarehousesApi.setStatus(id, status),
    onSuccess: (wh) => {
      toast.success(`Warehouse ${wh.code} marked ${wh.status}.`);
      qc.invalidateQueries({ queryKey: QK.warehouses });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateWarehouseInput }) =>
      WarehousesApi.update(id, input),
    onSuccess: () => {
      toast.success('Warehouse updated.');
      qc.invalidateQueries({ queryKey: QK.warehouses });
      setEditWh(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deactivateMut = useMutation({
    mutationFn: (id: string) => WarehousesApi.deactivate(id),
    onSuccess: (wh) => {
      toast.success(`Warehouse ${wh.code} deactivated.`);
      qc.invalidateQueries({ queryKey: QK.warehouses });
      setDeactivateWh(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const columns: Column<Warehouse>[] = [
    { header: 'Code', accessor: (w) => <span className="font-mono">{w.code}</span>, width: '120px' },
    { header: 'Name', accessor: (w) => w.name },
    { header: 'City', accessor: (w) => w.city ?? '—', width: '160px' },
    { header: 'Country', accessor: (w) => w.country, width: '90px' },
    {
      header: 'Status',
      accessor: (w) => (
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            w.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {w.status}
        </span>
      ),
      width: '110px',
    },
    {
      header: 'Actions',
      accessor: (w) =>
        canMutate ? (
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="secondary" onClick={() => setEditWh(w)}>
              Edit
            </Button>
            {w.status === 'active' ? (
              <Button size="sm" variant="secondary" onClick={() => setDeactivateWh(w)}>
                Deactivate
              </Button>
            ) : (
              <Button
                size="sm"
                variant="primary"
                loading={statusMut.isPending && statusMut.variables?.id === w.id}
                onClick={() => statusMut.mutate({ id: w.id, status: 'active' })}
              >
                Activate
              </Button>
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
      width: '260px',
    },
  ];

  return (
    <div className="space-y-4">
      <AppPageHeader
        title="Warehouses"
        description="Physical warehouse sites used for inventory, locations, and order workflows."
      />

      <FilterPanel
        title="Warehouse filters"
        onApply={applyFilters}
        onReset={resetFilters}
        loading={list.isFetching}
      >
        <TextField
          label="Search"
          value={draftFilters.search}
          onChange={(e) => setDraft({ search: e.target.value })}
          placeholder="Code, name, city, or country"
        />
        <SelectField
          label="Status"
          value={draftFilters.status}
          onChange={(e) => setDraft({ status: e.target.value as StatusFilter })}
          options={[
            { value: '', label: 'All statuses' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={draftFilters.includeInactive}
            onChange={(e) => setDraft({ includeInactive: e.target.checked })}
          />
          Include inactive in API fetch
        </label>
      </FilterPanel>

      <DataTable
        title="Warehouse sites"
        description="Operators can activate or deactivate warehouses. Deactivation requires all locations to be archived."
        actions={
          canMutate ? (
            <Button onClick={() => setOpenCreate(true)}>+ New warehouse</Button>
          ) : undefined
        }
        columns={columns}
        rows={filteredRows}
        rowKey={(w) => w.id}
        loading={list.isLoading}
        empty="No warehouses match your filters."
      />

      <CreateWarehouseModal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        loading={createMut.isPending}
        onSubmit={(input) => createMut.mutate(input)}
      />

      <EditWarehouseModal
        open={!!editWh}
        warehouse={editWh}
        loading={updateMut.isPending}
        onClose={() => setEditWh(null)}
        onSubmit={(input) => editWh && updateMut.mutate({ id: editWh.id, input })}
      />

      <ConfirmModal
        open={!!deactivateWh}
        title="Deactivate warehouse"
        confirmLabel="Deactivate"
        danger
        loading={deactivateMut.isPending}
        onClose={() => !deactivateMut.isPending && setDeactivateWh(null)}
        onConfirm={() => deactivateWh && deactivateMut.mutate(deactivateWh.id)}
      >
        {deactivateWh ? (
          <p className="text-sm text-slate-600">
            Deactivate <span className="font-mono font-semibold">{deactivateWh.code}</span> —{' '}
            {deactivateWh.name}? This warehouse will no longer appear in default operational lists.
          </p>
        ) : null}
      </ConfirmModal>
    </div>
  );
}

interface CreateWarehouseModalProps {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  onSubmit: (input: CreateWarehouseInput) => void;
}

function CreateWarehouseModal({ open, onClose, loading, onSubmit }: CreateWarehouseModalProps) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [country, setCountry] = useState('SA');
  const [city, setCity] = useState('');
  const [otherCity, setOtherCity] = useState('');
  const [address, setAddress] = useState('');
  const [generating, setGenerating] = useState(false);

  const cityOptions = useMemo(() => {
    const c = COUNTRIES.find((x) => x.code === country);
    return c ? c.cities : [];
  }, [country]);

  useEffect(() => {
    setCity('');
    setOtherCity('');
  }, [country]);

  const reset = () => {
    setName('');
    setCode('');
    setCountry('SA');
    setCity('');
    setOtherCity('');
    setAddress('');
  };

  const handleClose = () => {
    if (!loading) {
      reset();
      onClose();
    }
  };

  const generateCode = async () => {
    setGenerating(true);
    try {
      const { code: next } = await WarehousesApi.nextCode();
      setCode(next);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const finalCity = country === OTHER_COUNTRY ? otherCity.trim() : city || undefined;
    const finalCountry = country === OTHER_COUNTRY ? undefined : country;
    onSubmit({
      name,
      code: code.trim() || undefined,
      country: finalCountry,
      city: finalCity || undefined,
      address: address || undefined,
    });
  };

  const COUNTRY_OPTIONS = [
    ...COUNTRIES.map((c) => ({ value: c.code, label: `${c.name} (${c.code})` })),
    { value: OTHER_COUNTRY, label: 'Other / not listed' },
  ];

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="New warehouse"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button form="create-wh" type="submit" loading={loading}>
            Create
          </Button>
        </>
      }
    >
      <form id="create-wh" onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <TextField
            label="Code (optional)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Leave blank to auto-generate"
          />
          <Button type="button" size="sm" variant="secondary" loading={generating} onClick={generateCode}>
            Generate Code
          </Button>
        </div>
        <TextField label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            options={COUNTRY_OPTIONS}
          />
          {country === OTHER_COUNTRY ? (
            <TextField label="City" value={otherCity} onChange={(e) => setOtherCity(e.target.value)} />
          ) : (
            <SelectField
              label="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              options={cityOptions.map((c) => ({ value: c, label: c }))}
              placeholder="Select a city…"
            />
          )}
        </div>
        <TextField label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
      </form>
    </Modal>
  );
}

function EditWarehouseModal({
  open,
  warehouse,
  loading,
  onClose,
  onSubmit,
}: {
  open: boolean;
  warehouse: Warehouse | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (input: UpdateWarehouseInput) => void;
}) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');

  useEffect(() => {
    if (warehouse) {
      setName(warehouse.name);
      setAddress(warehouse.address ?? '');
      setCity(warehouse.city ?? '');
      setCountry(warehouse.country);
    }
  }, [warehouse]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      address: address || undefined,
      city: city || undefined,
      country,
    });
  };

  if (!warehouse) return null;

  return (
    <Modal
      open={open}
      onClose={() => !loading && onClose()}
      title={`Edit ${warehouse.code}`}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="edit-wh" loading={loading}>
            Save
          </Button>
        </>
      }
    >
      <form id="edit-wh" className="space-y-3" onSubmit={submit}>
        <TextField label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <TextField label="City" value={city} onChange={(e) => setCity(e.target.value)} />
          <TextField label="Country" value={country} onChange={(e) => setCountry(e.target.value)} />
        </div>
      </form>
    </Modal>
  );
}
