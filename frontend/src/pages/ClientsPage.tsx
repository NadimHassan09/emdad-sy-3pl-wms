import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import {
  CompaniesApi,
  type CompanyListRow,
  type CompanyStatus,
  type CreateCompanyPayload,
  type UpdateCompanyPayload,
} from '../api/companies';
import { Button } from '../components/Button';
import { DataTable, type Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { SelectField } from '../components/SelectField';
import { StatusBadge } from '../components/StatusBadge';
import { TextField } from '../components/TextField';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';

const TEXTAREA_CLASS =
  'mt-1 block w-full min-h-[72px] rounded-md border border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'offboarding', label: 'Offboarding' },
  { value: 'closed', label: 'Closed' },
];

const emptyCreate: CreateCompanyPayload = {
  name: '',
  contactEmail: '',
  tradeName: '',
  country: 'SA',
  city: '',
  contactPhone: '',
  address: '',
  notes: '',
};

function FieldTextarea({
  label,
  value,
  onChange,
  id,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  id: string;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <textarea
        id={id}
        className={TEXTAREA_CLASS}
        value={value}
        spellCheck
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function ClientsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<CompanyListRow | null>(null);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<CreateCompanyPayload>(emptyCreate);
  const [editForm, setEditForm] = useState<UpdateCompanyPayload>({});

  useEffect(() => {
    if (!openActionId) return;
    const onPointerDown = (ev: PointerEvent) => {
      const target = ev.target as Element | null;
      if (!target) return;
      if (
        target.closest('[data-client-action-trigger="true"]') ||
        target.closest('[data-client-action-menu-button="true"]')
      ) {
        return;
      }
      setOpenActionId(null);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [openActionId]);

  const companiesKey = QK.companies;

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: companiesKey,
    queryFn: () => CompaniesApi.list({ includeAll: true }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: companiesKey });

  const createMut = useMutation({
    mutationFn: () => {
      const p: CreateCompanyPayload = {
        name: createForm.name.trim(),
        contactEmail: createForm.contactEmail.trim(),
        country: (createForm.country ?? 'SA').trim() || 'SA',
      };
      if (createForm.tradeName?.trim()) p.tradeName = createForm.tradeName.trim();
      if (createForm.city?.trim()) p.city = createForm.city.trim();
      if (createForm.contactPhone?.trim()) p.contactPhone = createForm.contactPhone.trim();
      if (createForm.address?.trim()) p.address = createForm.address.trim();
      if (createForm.notes?.trim()) p.notes = createForm.notes.trim();
      return CompaniesApi.create(p);
    },
    onSuccess: () => {
      toast.success('Company created.');
      setCreateOpen(false);
      setCreateForm(emptyCreate);
      setOpenActionId(null);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMut = useMutation({
    mutationFn: () => {
      if (!editRow) throw new Error('No row');
      return CompaniesApi.update(editRow.id, editForm);
    },
    onSuccess: () => {
      toast.success('Company saved.');
      setEditRow(null);
      setEditForm({});
      setOpenActionId(null);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const suspendMut = useMutation({
    mutationFn: (id: string) => CompaniesApi.suspend(id),
    onSuccess: () => {
      toast.success('Client suspended.');
      setOpenActionId(null);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => CompaniesApi.remove(id),
    onSuccess: () => {
      toast.success('Company deleted.');
      setOpenActionId(null);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openEdit = (r: CompanyListRow) => {
    setEditRow(r);
    setEditForm({
      name: r.name,
      tradeName: r.tradeName ?? '',
      contactEmail: r.contactEmail,
      country: r.country ?? 'SA',
      city: r.city ?? '',
      contactPhone: r.contactPhone ?? '',
      address: r.address ?? '',
      notes: r.notes ?? '',
      status: r.status,
    });
  };

  const closeCreate = () => {
    if (!createMut.isPending) {
      setCreateForm(emptyCreate);
      setCreateOpen(false);
    }
  };

  const closeEdit = () => {
    if (!updateMut.isPending) {
      setEditRow(null);
      setEditForm({});
    }
  };

  const submitCreate = (e: FormEvent) => {
    e.preventDefault();
    createMut.mutate();
  };

  const submitEdit = (e: FormEvent) => {
    e.preventDefault();
    updateMut.mutate();
  };

  const columns: Column<CompanyListRow>[] = useMemo(
    () => [
      { header: 'Name', accessor: (r) => <span className="text-slate-800">{r.name}</span> },
      { header: 'Trade name', accessor: (r) => <span className="text-slate-600">{r.tradeName ?? '—'}</span> },
      { header: 'Email', accessor: (r) => <span className="text-slate-700">{r.contactEmail}</span> },
      { header: 'Phone', accessor: (r) => <span className="text-slate-600">{r.contactPhone ?? '—'}</span> },
      { header: 'City', accessor: (r) => <span className="text-slate-600">{r.city ?? '—'}</span> },
      { header: 'Country', accessor: (r) => <span className="text-slate-600">{r.country ?? '—'}</span> },
      {
        header: 'Billing',
        accessor: (r) => (
          <span className="text-slate-600">
            {r.billingCycle} · {r.paymentTermsDays}d
          </span>
        ),
      },
      {
        header: 'Status',
        accessor: (r) => <StatusBadge status={r.status} />,
      },
      {
        header: 'Actions',
        className: 'min-w-[120px] text-right',
        accessor: (r) => {
          const busy =
            suspendMut.isPending || removeMut.isPending || updateMut.isPending || createMut.isPending;
          const menuOpen = openActionId === r.id;
          return (
            <div className="relative inline-flex">
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-100"
                disabled={busy}
                data-client-action-trigger="true"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenActionId((cur) => (cur === r.id ? null : r.id));
                }}
                aria-label="Open actions"
                aria-expanded={menuOpen}
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <path d="M4 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm4.5 0a1.5 1.5 0 1 1 3.001 0A1.5 1.5 0 0 1 8.5 10ZM13 10a1.5 1.5 0 1 1 3.001 0A1.5 1.5 0 0 1 13 10Z" />
                </svg>
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-9 z-10 min-w-[140px] overflow-hidden rounded-md border border-slate-200 bg-white shadow-md">
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                    data-client-action-menu-button="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenActionId(null);
                      openEdit(r);
                    }}
                  >
                    Edit
                  </button>
                  {r.status === 'active' ? (
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                      data-client-action-menu-button="true"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Suspend operations for "${r.name}"?`)) suspendMut.mutate(r.id);
                      }}
                    >
                      Suspend
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-rose-700 transition hover:bg-rose-50"
                    data-client-action-menu-button="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        window.confirm(
                          `Permanently delete "${r.name}"? This only succeeds if there are no linked products, orders, or users. Otherwise the server will reject the request.`,
                        )
                      ) {
                        removeMut.mutate(r.id);
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
          );
        },
      },
    ],
    [suspendMut.isPending, removeMut.isPending, updateMut.isPending, createMut.isPending, openActionId],
  );

  const errMsg = error instanceof Error ? error.message : null;

  return (
    <>
      <PageHeader
        title="Clients"
        actions={
          <Button
            type="button"
            className="border border-[#1a7a44] bg-[#1a7a44] text-white hover:bg-[#146135]"
            onClick={() => setCreateOpen(true)}
          >
            + New company
          </Button>
        }
      />

      {errMsg ? <p className="mb-4 text-sm text-rose-600">{errMsg}</p> : null}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={isLoading}
        empty="No companies yet."
      />

      <Modal
        open={createOpen}
        onClose={closeCreate}
        title="New company"
        widthClass="max-w-xl"
        footer={
          <>
            <Button variant="secondary" type="button" onClick={closeCreate} disabled={createMut.isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-company"
              loading={createMut.isPending}
              className="border border-[#1a7a44] bg-[#1a7a44] text-white hover:bg-[#146135]"
            >
              Create
            </Button>
          </>
        }
      >
        <form id="create-company" onSubmit={submitCreate} className="max-h-[calc(100vh-220px)] space-y-3 overflow-y-auto pr-1">
          <TextField
            label="Name"
            required
            name="name"
            value={createForm.name}
            onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
          />
          <TextField
            label="Trade name (optional)"
            name="tradeName"
            value={createForm.tradeName ?? ''}
            onChange={(e) => setCreateForm((f) => ({ ...f, tradeName: e.target.value }))}
          />
          <TextField
            label="Contact email"
            type="email"
            required
            name="contactEmail"
            value={createForm.contactEmail}
            onChange={(e) => setCreateForm((f) => ({ ...f, contactEmail: e.target.value }))}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField
              label="Country"
              name="country"
              value={createForm.country ?? ''}
              onChange={(e) => setCreateForm((f) => ({ ...f, country: e.target.value }))}
            />
            <TextField
              label="City"
              name="city"
              value={createForm.city ?? ''}
              onChange={(e) => setCreateForm((f) => ({ ...f, city: e.target.value }))}
            />
          </div>
          <TextField
            label="Phone (optional)"
            name="contactPhone"
            value={createForm.contactPhone ?? ''}
            onChange={(e) => setCreateForm((f) => ({ ...f, contactPhone: e.target.value }))}
          />
          <FieldTextarea
            id="create-address"
            label="Address (optional)"
            value={createForm.address ?? ''}
            onChange={(v) => setCreateForm((f) => ({ ...f, address: v }))}
          />
          <FieldTextarea
            id="create-notes"
            label="Notes (optional)"
            value={createForm.notes ?? ''}
            onChange={(v) => setCreateForm((f) => ({ ...f, notes: v }))}
          />
        </form>
      </Modal>

      <Modal
        open={!!editRow}
        onClose={closeEdit}
        title={editRow ? `Edit ${editRow.name}` : 'Edit company'}
        widthClass="max-w-xl"
        footer={
          <>
            <Button variant="secondary" type="button" onClick={closeEdit} disabled={updateMut.isPending}>
              Cancel
            </Button>
            <Button type="submit" form="edit-company" loading={updateMut.isPending}>
              Save
            </Button>
          </>
        }
      >
        <form id="edit-company" onSubmit={submitEdit} className="space-y-3">
          <SelectField
            label="Status"
            name="status"
            value={editForm.status ?? editRow?.status ?? 'active'}
            onChange={(e) =>
              setEditForm((f) => ({ ...f, status: e.target.value as CompanyStatus }))
            }
            options={STATUS_OPTIONS}
          />
          <TextField
            label="Name"
            name="edit-name"
            value={editForm.name ?? ''}
            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
          />
          <TextField
            label="Trade name"
            name="edit-tradeName"
            value={editForm.tradeName ?? ''}
            onChange={(e) => setEditForm((f) => ({ ...f, tradeName: e.target.value }))}
          />
          <TextField
            label="Contact email"
            type="email"
            name="edit-contactEmail"
            value={editForm.contactEmail ?? ''}
            onChange={(e) => setEditForm((f) => ({ ...f, contactEmail: e.target.value }))}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField
              label="Country"
              name="edit-country"
              value={editForm.country ?? ''}
              onChange={(e) => setEditForm((f) => ({ ...f, country: e.target.value }))}
            />
            <TextField
              label="City"
              name="edit-city"
              value={editForm.city ?? ''}
              onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
            />
          </div>
          <TextField
            label="Phone"
            name="edit-phone"
            value={editForm.contactPhone ?? ''}
            onChange={(e) => setEditForm((f) => ({ ...f, contactPhone: e.target.value }))}
          />
          <FieldTextarea
            id="edit-address"
            label="Address"
            value={editForm.address ?? ''}
            onChange={(v) => setEditForm((f) => ({ ...f, address: v }))}
          />
          <FieldTextarea
            id="edit-notes"
            label="Notes"
            value={editForm.notes ?? ''}
            onChange={(v) => setEditForm((f) => ({ ...f, notes: v }))}
          />
        </form>
      </Modal>
    </>
  );
}
