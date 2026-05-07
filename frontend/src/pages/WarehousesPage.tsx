import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import {
  CreateWarehouseInput,
  UpdateWarehouseInput,
  Warehouse,
  WarehouseStatus,
  WarehousesApi,
} from '../api/warehouses';
import { Button } from '../components/Button';
import { Column, DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { SelectField } from '../components/SelectField';
import { TextField } from '../components/TextField';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import { COUNTRIES, OTHER_COUNTRY } from '../lib/geography';

export function WarehousesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [openCreate, setOpenCreate] = useState(false);
  const [editWh, setEditWh] = useState<Warehouse | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const listKey = useMemo(() => [...QK.warehouses, showInactive] as const, [showInactive]);

  const list = useQuery({
    queryKey: listKey,
    queryFn: () => WarehousesApi.list(showInactive),
  });

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
      accessor: (w) => (
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="secondary" onClick={() => setEditWh(w)}>
            Edit
          </Button>
          {w.status !== 'active' && (
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
      ),
      width: '220px',
    },
  ];

  return (
    <>
      <PageHeader
        title="Warehouses"
        description="Physical sites. Operators can Activate inactive warehouses from this list."
        actions={<Button onClick={() => setOpenCreate(true)}>+ New warehouse</Button>}
      />

      <label className="mb-3 flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={showInactive}
          onChange={(e) => setShowInactive(e.target.checked)}
        />
        Show inactive warehouses
      </label>

      <DataTable
        columns={columns}
        rows={list.data ?? []}
        rowKey={(w) => w.id}
        loading={list.isLoading}
        empty="No warehouses yet."
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
    </>
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
