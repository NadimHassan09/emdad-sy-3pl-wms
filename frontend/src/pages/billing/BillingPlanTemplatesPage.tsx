import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  BillingApi,
  type BillingPlanTemplateRow,
  type CreateBillingPlanTemplatePayload,
  type UpdateBillingPlanTemplatePayload,
} from '../../api/billing';
import { AdminListPageShell } from '../../components/AdminListPageShell';
import { AnchoredDropdown } from '../../components/AnchoredDropdown';
import { Button } from '../../components/Button';
import { DataTable, type Column } from '../../components/DataTable';
import { PANEL_CARD_CLASS } from '../../components/FilterPanel';
import { Modal } from '../../components/Modal';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/ToastProvider';
import { QK } from '../../constants/query-keys';
import { useAuth } from '../../auth/AuthContext';
import { formatDecimal } from '../../lib/billing-plan-overview';
import { MODAL_CANCEL_BUTTON_CLASS } from '../../lib/modal-button-styles';

const CURRENCY = 'USD';

type TemplateForm = {
  name: string;
  reservedVolume: string;
  fixedSubscriptionFee: string;
  cycleLengthDays: string;
};

const EMPTY_FORM: TemplateForm = {
  name: '',
  reservedVolume: '0',
  fixedSubscriptionFee: '0',
  cycleLengthDays: '30',
};

function toPayload(form: TemplateForm): CreateBillingPlanTemplatePayload {
  return {
    name: form.name.trim(),
    reservedVolume: Number(form.reservedVolume) || 0,
    fixedSubscriptionFee: Number(form.fixedSubscriptionFee) || 0,
    cycleLengthDays: Math.max(1, Math.floor(Number(form.cycleLengthDays)) || 30),
  };
}

export function BillingPlanTemplatesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const canMutate = user?.role === 'super_admin' || user?.role === 'wh_manager';

  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BillingPlanTemplateRow | null>(null);
  const [form, setForm] = useState<TemplateForm>(EMPTY_FORM);

  useEffect(() => {
    if (!openActionId) return;
    const onPointerDown = (ev: PointerEvent) => {
      const target = ev.target as Element | null;
      if (!target) return;
      if (
        target.closest('[data-billing-action-trigger="true"]') ||
        target.closest('[data-billing-action-menu="true"]') ||
        target.closest('[data-billing-action-menu-button="true"]')
      ) {
        return;
      }
      setOpenActionId(null);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [openActionId]);

  const templatesQuery = useQuery({
    queryKey: [...QK.billing.templates, appliedSearch],
    queryFn: () => BillingApi.listTemplates({ search: appliedSearch || undefined }),
  });

  const rows = templatesQuery.data ?? [];

  const invalidate = () => void qc.invalidateQueries({ queryKey: QK.billing.templates });

  const createMut = useMutation({
    mutationFn: (payload: CreateBillingPlanTemplatePayload) => BillingApi.createTemplate(payload),
    onSuccess: () => {
      toast.success('Template created.');
      setModalOpen(false);
      setForm(EMPTY_FORM);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMut = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateBillingPlanTemplatePayload;
    }) => BillingApi.updateTemplate(id, payload),
    onSuccess: () => {
      toast.success('Template updated.');
      setModalOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => BillingApi.deleteTemplate(id),
    onSuccess: () => {
      toast.success('Template deleted.');
      setOpenActionId(null);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (row: BillingPlanTemplateRow) => {
    setEditing(row);
    setForm({
      name: row.name,
      reservedVolume: row.reservedVolume,
      fixedSubscriptionFee: row.fixedSubscriptionFee,
      cycleLengthDays: String(row.cycleLengthDays),
    });
    setModalOpen(true);
    setOpenActionId(null);
  };

  const saving = createMut.isPending || updateMut.isPending;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Template name is required.');
      return;
    }
    const payload = toPayload(form);
    if (editing) {
      updateMut.mutate({ id: editing.id, payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const columns: Column<BillingPlanTemplateRow>[] = useMemo(
    () => [
      {
        header: 'Name',
        accessor: (r) => <span className="font-medium text-text-strong">{r.name}</span>,
      },
      {
        header: 'Reserved volume',
        accessor: (r) => `${formatDecimal(r.reservedVolume, 2)} m³`,
      },
      {
        header: 'Price',
        accessor: (r) => `${formatDecimal(r.fixedSubscriptionFee)} ${CURRENCY}`,
      },
      {
        header: 'Billing cycle',
        accessor: (r) => `${r.cycleLengthDays} days`,
      },
      {
        header: 'Status',
        accessor: (r) => (
          <span className={`badge w-fit ${r.active ? 'badge-complete' : 'badge-draft'}`}>
            {r.active ? 'Active' : 'Inactive'}
          </span>
        ),
      },
      {
        header: 'Actions',
        accessor: (r) =>
          canMutate ? (
            <div
              className="relative"
              data-billing-action-trigger="true"
              onClick={(e) => e.stopPropagation()}
            >
              <AnchoredDropdown
                open={openActionId === r.id}
                align="end"
                menuRootProps={{ 'data-billing-action-menu': 'true' }}
                trigger={
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-text-body transition hover:bg-surface-card-muted"
                    data-billing-action-menu-button="true"
                    onClick={() => setOpenActionId((cur) => (cur === r.id ? null : r.id))}
                    aria-label="Open actions"
                  >
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
                      <path d="M4 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm4.5 0a1.5 1.5 0 1 1 3.001 0A1.5 1.5 0 0 1 8.5 10ZM13 10a1.5 1.5 0 1 1 3.001 0A1.5 1.5 0 0 1 13 10Z" />
                    </svg>
                  </button>
                }
              >
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-text-body hover:bg-surface-hover"
                  onClick={() => openEdit(r)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-status-danger-fg hover:bg-status-danger-bg"
                  onClick={() => {
                    if (!window.confirm(`Delete template “${r.name}”?`)) return;
                    deleteMut.mutate(r.id);
                  }}
                >
                  Delete
                </button>
              </AnchoredDropdown>
            </div>
          ) : (
            '—'
          ),
      },
    ],
    [canMutate, openActionId, deleteMut],
  );

  return (
    <AdminListPageShell
      icon="fa-layer-group"
      title="Plan templates"
      subtitle="Reusable subscription templates with reserved volume, price, and cycle length."
      actions={
        canMutate ? (
          <Button variant="brand" onClick={openCreate}>
            + Create template
          </Button>
        ) : undefined
      }
    >
      <div className={`${PANEL_CARD_CLASS} mb-0 flex flex-wrap items-end gap-3`}>
        <div className="min-w-[16rem] flex-1">
          <TextField
            label="Search templates"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Template name"
          />
        </div>
        <Button
          variant="danger"
          onClick={() => {
            setSearch('');
            setAppliedSearch('');
          }}
        >
          Reset
        </Button>
        <Button variant="brand" onClick={() => setAppliedSearch(search.trim())}>
          Apply
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={templatesQuery.isPending}
        empty="No plan templates yet."
        onRowClick={canMutate ? openEdit : undefined}
      />

      {templatesQuery.isError ? (
        <p className="text-sm text-status-danger-fg">{(templatesQuery.error as Error).message}</p>
      ) : null}

      <Modal
        open={modalOpen}
        onClose={() => {
          if (saving) return;
          setModalOpen(false);
          setEditing(null);
        }}
        title={editing ? 'Edit plan template' : 'Create plan template'}
        widthClass="max-w-lg"
        footer={
          <>
            <Button
              type="button"
              variant="danger"
              className={MODAL_CANCEL_BUTTON_CLASS}
              disabled={saving}
              onClick={() => {
                setModalOpen(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" form="billing-template-form" variant="brand" loading={saving}>
              {editing ? 'Save changes' : 'Create template'}
            </Button>
          </>
        }
      >
        <form id="billing-template-form" className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <div className="sm:col-span-2">
            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <TextField
            label="Reserved volume (m³)"
            type="number"
            min={0}
            step="0.01"
            value={form.reservedVolume}
            onChange={(e) => setForm((f) => ({ ...f, reservedVolume: e.target.value }))}
            required
          />
          <TextField
            label={`Price (${CURRENCY})`}
            type="number"
            min={0}
            step="0.01"
            value={form.fixedSubscriptionFee}
            onChange={(e) => setForm((f) => ({ ...f, fixedSubscriptionFee: e.target.value }))}
            required
          />
          <TextField
            label="Billing cycle (days)"
            type="number"
            min={1}
            step="1"
            value={form.cycleLengthDays}
            onChange={(e) => setForm((f) => ({ ...f, cycleLengthDays: e.target.value }))}
            required
          />
        </form>
      </Modal>
    </AdminListPageShell>
  );
}
