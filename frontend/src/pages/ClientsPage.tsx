import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  CompaniesApi,
  type CompanyListRow,
  type CompanyStatus,
  type CreateCompanyPayload,
  type UpdateCompanyPayload,
} from '../api/companies';
import { AnchoredDropdown } from '../components/AnchoredDropdown';
import { Button } from '../components/Button';
import { DataTable, type Column } from '../components/DataTable';
import { FilterPanel } from '../components/FilterPanel';
import { Modal } from '../components/Modal';
import { SelectField } from '../components/SelectField';
import { StatusBadge } from '../components/StatusBadge';
import { TextField } from '../components/TextField';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import { useFilters } from '../hooks/useFilters';
import { MODAL_CANCEL_BUTTON_CLASS } from '../lib/modal-button-styles';

type ClientSearchCategory = 'name' | 'tradeName' | 'email' | 'phone' | 'city' | 'country';

type ClientListFilters = {
  search: string;
  searchCategory: ClientSearchCategory;
};

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
  const navigate = useNavigate();
  const isArabic =
    typeof window !== 'undefined' && (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const qc = useQueryClient();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<CompanyListRow | null>(null);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<CreateCompanyPayload>(emptyCreate);

  const initialClientFilters = useMemo<ClientListFilters>(
    () => ({ search: '', searchCategory: 'name' }),
    [],
  );
  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters(initialClientFilters);
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

  const { data: rows = [], isLoading, isFetching, error } = useQuery({
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
      { header: t('Name', 'الاسم'), accessor: (r) => <span className="text-slate-800">{r.name}</span> },
      { header: t('Trade name', 'الاسم التجاري'), accessor: (r) => <span className="text-slate-600">{r.tradeName ?? '—'}</span> },
      { header: t('Email', 'البريد الإلكتروني'), accessor: (r) => <span className="text-slate-700">{r.contactEmail}</span> },
      { header: t('Phone', 'الهاتف'), accessor: (r) => <span className="text-slate-600">{r.contactPhone ?? '—'}</span> },
      { header: t('City', 'المدينة'), accessor: (r) => <span className="text-slate-600">{r.city ?? '—'}</span> },
      { header: t('Country', 'الدولة'), accessor: (r) => <span className="text-slate-600">{r.country ?? '—'}</span> },
      {
        header: t('Billing', 'الفوترة'),
        accessor: (r) => (
          <span className="text-slate-600">
            {r.billingCycle} · {r.paymentTermsDays}d
          </span>
        ),
      },
      {
        header: t('Status', 'الحالة'),
        accessor: (r) => <StatusBadge status={r.status} />,
      },
      {
        header: t('Actions', 'الإجراءات'),
        className: 'min-w-[120px] text-right',
        accessor: (r) => {
          const busy =
            suspendMut.isPending || removeMut.isPending || updateMut.isPending || createMut.isPending;
          return (
            <div className="inline-flex" onClick={(e) => e.stopPropagation()}>
              <AnchoredDropdown
                open={openActionId === r.id}
                align="end"
                menuRootProps={{ 'data-client-action-menu': 'true' }}
                trigger={
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-100"
                    disabled={busy}
                    data-client-action-trigger="true"
                    onClick={() => setOpenActionId((cur) => (cur === r.id ? null : r.id))}
                    aria-label="Open actions"
                    aria-expanded={openActionId === r.id}
                    aria-haspopup="menu"
                  >
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
                      <path d="M4 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm4.5 0a1.5 1.5 0 1 1 3.001 0A1.5 1.5 0 0 1 8.5 10ZM13 10a1.5 1.5 0 1 1 3.001 0A1.5 1.5 0 0 1 13 10Z" />
                    </svg>
                  </button>
                }
              >
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                  data-client-action-menu-button="true"
                  onClick={() => {
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
                    onClick={() => {
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
                  onClick={() => {
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
              </AnchoredDropdown>
            </div>
          );
        },
      },
    ],
    [suspendMut.isPending, removeMut.isPending, updateMut.isPending, createMut.isPending, openActionId, isArabic],
  );

  const errMsg = error instanceof Error ? error.message : null;
  const filteredRows = useMemo(() => {
    const q = appliedFilters.search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const value = (() => {
        switch (appliedFilters.searchCategory) {
          case 'tradeName':
            return r.tradeName ?? '';
          case 'email':
            return r.contactEmail ?? '';
          case 'phone':
            return r.contactPhone ?? '';
          case 'city':
            return r.city ?? '';
          case 'country':
            return r.country ?? '';
          case 'name':
          default:
            return r.name ?? '';
        }
      })();
      return value.toLowerCase().includes(q);
    });
  }, [rows, appliedFilters.search, appliedFilters.searchCategory]);

  return (
    <>
      {errMsg ? <p className="mb-4 text-sm text-rose-600">{errMsg}</p> : null}

      <FilterPanel
        title={t('Client filters', 'فلاتر العملاء')}
        onApply={applyFilters}
        onReset={resetFilters}
        loading={isFetching}
        applyLabel={t('Apply filters', 'تطبيق الفلاتر')}
        resetLabel={t('Reset filters', 'إعادة تعيين الفلاتر')}
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full min-w-[10rem] max-w-[25%] flex-1 basis-32">
            <TextField
              label={t('Search', 'بحث')}
              value={draftFilters.search}
              onChange={(e) => setDraft({ search: e.target.value })}
              placeholder={t('Search client...', 'ابحث عن عميل...')}
            />
          </div>
          <SelectField
            label={t('Search by', 'البحث حسب')}
            name="clientSearchCategory"
            value={draftFilters.searchCategory}
            onChange={(e) =>
              setDraft({ searchCategory: e.target.value as ClientSearchCategory })
            }
            options={[
              { value: 'name', label: t('Company name', 'اسم الشركة') },
              { value: 'tradeName', label: t('Trade name', 'الاسم التجاري') },
              { value: 'email', label: t('Email', 'البريد الإلكتروني') },
              { value: 'phone', label: t('Phone', 'الهاتف') },
              { value: 'city', label: t('City', 'المدينة') },
              { value: 'country', label: t('Country', 'الدولة') },
            ]}
            className="min-w-[8.75rem] max-w-[11rem] shrink-0"
          />
        </div>
      </FilterPanel>

      <DataTable
        title={t('Clients', 'العملاء')}
        actions={
          <Button type="button" variant="brand" onClick={() => setCreateOpen(true)}>
            {t('+ New company', '+ شركة جديدة')}
          </Button>
        }
        columns={columns}
        rows={filteredRows}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate(`/clients/${r.id}`)}
        loading={isLoading}
        empty={t('No companies yet.', 'لا توجد شركات بعد.')}
        labels={{
          rowsSuffix: t('rows', 'صف'),
          resultsSuffix: t('results', 'نتيجة'),
          ofWord: t('of', 'من'),
          previous: t('Previous', 'السابق'),
          next: t('Next', 'التالي'),
          rowsPerPageAria: t('Rows per page', 'عدد الصفوف لكل صفحة'),
        }}
      />

      <Modal
        open={createOpen}
        onClose={closeCreate}
        title={t('New company', 'شركة جديدة')}
        widthClass="max-w-xl"
        footer={
          <>
            <Button
              variant="danger"
              className={MODAL_CANCEL_BUTTON_CLASS}
              type="button"
              onClick={closeCreate}
              disabled={createMut.isPending}
            >
              {t('Cancel', 'إلغاء')}
            </Button>
            <Button
              type="submit"
              form="create-company"
              variant="brand"
              loading={createMut.isPending}
            >
              {t('Create', 'إنشاء')}
            </Button>
          </>
        }
      >
        <form id="create-company" onSubmit={submitCreate} className="max-h-[calc(100vh-220px)] space-y-3 overflow-y-auto pr-1">
          <TextField
            label={t('Name', 'الاسم')}
            required
            name="name"
            value={createForm.name}
            onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
          />
          <TextField
            label={t('Trade name (optional)', 'الاسم التجاري (اختياري)')}
            name="tradeName"
            value={createForm.tradeName ?? ''}
            onChange={(e) => setCreateForm((f) => ({ ...f, tradeName: e.target.value }))}
          />
          <TextField
            label={t('Contact email', 'البريد الإلكتروني للتواصل')}
            type="email"
            required
            name="contactEmail"
            value={createForm.contactEmail}
            onChange={(e) => setCreateForm((f) => ({ ...f, contactEmail: e.target.value }))}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField
              label={t('Country', 'الدولة')}
              name="country"
              value={createForm.country ?? ''}
              onChange={(e) => setCreateForm((f) => ({ ...f, country: e.target.value }))}
            />
            <TextField
              label={t('City', 'المدينة')}
              name="city"
              value={createForm.city ?? ''}
              onChange={(e) => setCreateForm((f) => ({ ...f, city: e.target.value }))}
            />
          </div>
          <TextField
            label={t('Phone (optional)', 'الهاتف (اختياري)')}
            name="contactPhone"
            value={createForm.contactPhone ?? ''}
            onChange={(e) => setCreateForm((f) => ({ ...f, contactPhone: e.target.value }))}
          />
          <FieldTextarea
            id="create-address"
            label={t('Address (optional)', 'العنوان (اختياري)')}
            value={createForm.address ?? ''}
            onChange={(v) => setCreateForm((f) => ({ ...f, address: v }))}
          />
          <FieldTextarea
            id="create-notes"
            label={t('Notes (optional)', 'ملاحظات (اختياري)')}
            value={createForm.notes ?? ''}
            onChange={(v) => setCreateForm((f) => ({ ...f, notes: v }))}
          />
        </form>
      </Modal>

      <Modal
        open={!!editRow}
        onClose={closeEdit}
        title={editRow ? `${t('Edit', 'تعديل')} ${editRow.name}` : t('Edit company', 'تعديل شركة')}
        widthClass="max-w-xl"
        footer={
          <>
            <Button
              variant="danger"
              className={MODAL_CANCEL_BUTTON_CLASS}
              type="button"
              onClick={closeEdit}
              disabled={updateMut.isPending}
            >
              {t('Cancel', 'إلغاء')}
            </Button>
            <Button
              type="submit"
              form="edit-company"
              variant="brand"
              loading={updateMut.isPending}
            >
              {t('Save', 'حفظ')}
            </Button>
          </>
        }
      >
        <form id="edit-company" onSubmit={submitEdit} className="space-y-3">
          <SelectField
            label={t('Status', 'الحالة')}
            name="status"
            value={editForm.status ?? editRow?.status ?? 'active'}
            onChange={(e) =>
              setEditForm((f) => ({ ...f, status: e.target.value as CompanyStatus }))
            }
            options={STATUS_OPTIONS}
          />
          <TextField
            label={t('Name', 'الاسم')}
            name="edit-name"
            value={editForm.name ?? ''}
            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
          />
          <TextField
            label={t('Trade name', 'الاسم التجاري')}
            name="edit-tradeName"
            value={editForm.tradeName ?? ''}
            onChange={(e) => setEditForm((f) => ({ ...f, tradeName: e.target.value }))}
          />
          <TextField
            label={t('Contact email', 'البريد الإلكتروني للتواصل')}
            type="email"
            name="edit-contactEmail"
            value={editForm.contactEmail ?? ''}
            onChange={(e) => setEditForm((f) => ({ ...f, contactEmail: e.target.value }))}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField
              label={t('Country', 'الدولة')}
              name="edit-country"
              value={editForm.country ?? ''}
              onChange={(e) => setEditForm((f) => ({ ...f, country: e.target.value }))}
            />
            <TextField
              label={t('City', 'المدينة')}
              name="edit-city"
              value={editForm.city ?? ''}
              onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
            />
          </div>
          <TextField
            label={t('Phone', 'الهاتف')}
            name="edit-phone"
            value={editForm.contactPhone ?? ''}
            onChange={(e) => setEditForm((f) => ({ ...f, contactPhone: e.target.value }))}
          />
          <FieldTextarea
            id="edit-address"
            label={t('Address', 'العنوان')}
            value={editForm.address ?? ''}
            onChange={(v) => setEditForm((f) => ({ ...f, address: v }))}
          />
          <FieldTextarea
            id="edit-notes"
            label={t('Notes', 'ملاحظات')}
            value={editForm.notes ?? ''}
            onChange={(v) => setEditForm((f) => ({ ...f, notes: v }))}
          />
        </form>
      </Modal>
    </>
  );
}
