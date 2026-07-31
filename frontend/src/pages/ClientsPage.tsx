import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Alert } from '@ds';

import {
  CompaniesApi,
  type CompanyListRow,
  type CompanyStatus,
  type CreateCompanyPayload,
  type UpdateCompanyPayload,
} from '../api/companies';
import { AnchoredDropdown } from '../components/AnchoredDropdown';
import { Button } from '../components/Button';
import { CustomerLifecycleModal } from '../components/clients/CustomerLifecycleModal';
import { DataTable, type Column } from '../components/DataTable';
import { FilterPanel } from '../components/FilterPanel';
import { Modal } from '../components/Modal';
import { SelectField } from '../components/SelectField';
import { StatusBadge } from '../components/StatusBadge';
import { TextField } from '../components/TextField';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import { useAuth } from '../auth/AuthContext';
import { useFilters } from '../hooks/useFilters';
import {
  sanitizeCompanyPayload,
  validateCompanyForm,
  type CompanyFormErrors,
} from '../lib/company-form-validation';
import { MODAL_CANCEL_BUTTON_CLASS } from '../lib/modal-button-styles';

type ClientSearchCategory = 'name' | 'tradeName' | 'email' | 'phone' | 'city' | 'country';
type ClientStatusFilter = 'all' | 'active' | 'suspended' | 'archived';

type ClientListFilters = {
  search: string;
  searchCategory: ClientSearchCategory;
  status: ClientStatusFilter;
};

const TEXTAREA_CLASS =
  'mt-1 block w-full min-h-[72px] rounded-md border border-border-strong px-3 py-1.5 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200';
const TEXTAREA_ERROR_CLASS =
  'mt-1 block w-full min-h-[72px] rounded-md border border-status-danger-border px-3 py-1.5 text-sm shadow-sm focus:border-status-danger-border focus:outline-none focus:ring-2 focus:ring-status-danger-border/40';

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
  error,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  id: string;
  error?: string;
  required?: boolean;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-sm font-medium text-text-body">
        {label}
        {required ? <span className="text-status-error-fg"> *</span> : null}
      </span>
      <textarea
        id={id}
        className={error ? TEXTAREA_ERROR_CLASS : TEXTAREA_CLASS}
        value={value}
        spellCheck
        aria-invalid={error ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? <span className="mt-1 block text-xs text-status-error-fg">{error}</span> : null}
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
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<CompanyListRow | null>(null);
  const [lifecycleRow, setLifecycleRow] = useState<CompanyListRow | null>(null);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<CreateCompanyPayload>(emptyCreate);
  const [createErrors, setCreateErrors] = useState<CompanyFormErrors>({});
  const [editErrors, setEditErrors] = useState<CompanyFormErrors>({});

  const initialClientFilters = useMemo<ClientListFilters>(
    () => ({ search: '', searchCategory: 'name', status: 'all' }),
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
    mutationFn: (payload: CreateCompanyPayload) => CompaniesApi.create(payload),
    onSuccess: () => {
      toast.success('Company created.');
      setCreateOpen(false);
      setCreateForm(emptyCreate);
      setCreateErrors({});
      setOpenActionId(null);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCompanyPayload }) =>
      CompaniesApi.update(id, payload),
    onSuccess: () => {
      toast.success('Company saved.');
      setEditRow(null);
      setEditForm({});
      setEditErrors({});
      setOpenActionId(null);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openEdit = (r: CompanyListRow) => {
    setEditRow(r);
    setEditErrors({});
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
      setCreateErrors({});
      setCreateOpen(false);
    }
  };

  const closeEdit = () => {
    if (!updateMut.isPending) {
      setEditRow(null);
      setEditForm({});
      setEditErrors({});
    }
  };

  const submitCreate = (e: FormEvent) => {
    e.preventDefault();
    const fields = {
      name: createForm.name,
      tradeName: createForm.tradeName,
      contactEmail: createForm.contactEmail,
      country: createForm.country ?? '',
      city: createForm.city ?? '',
      contactPhone: createForm.contactPhone,
      address: createForm.address,
      notes: createForm.notes,
    };
    const errors = validateCompanyForm(fields, { isArabic, requireCity: true });
    setCreateErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error(t('Please fix the highlighted fields.', 'يرجى تصحيح الحقول المحددة.'));
      return;
    }
    const clean = sanitizeCompanyPayload(fields);
    createMut.mutate({
      name: clean.name,
      contactEmail: clean.contactEmail,
      country: clean.country,
      city: clean.city,
      ...(clean.tradeName ? { tradeName: clean.tradeName } : {}),
      ...(clean.contactPhone ? { contactPhone: clean.contactPhone } : {}),
      ...(clean.address ? { address: clean.address } : {}),
      ...(clean.notes ? { notes: clean.notes } : {}),
    });
  };

  const submitEdit = (e: FormEvent) => {
    e.preventDefault();
    if (!editRow) return;
    const fields = {
      name: editForm.name ?? '',
      tradeName: editForm.tradeName,
      contactEmail: editForm.contactEmail ?? '',
      country: editForm.country ?? '',
      city: editForm.city ?? '',
      contactPhone: editForm.contactPhone,
      address: editForm.address,
      notes: editForm.notes,
    };
    const errors = validateCompanyForm(fields, { isArabic, requireCity: true });
    setEditErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error(t('Please fix the highlighted fields.', 'يرجى تصحيح الحقول المحددة.'));
      return;
    }
    const clean = sanitizeCompanyPayload(fields);
    updateMut.mutate({
      id: editRow.id,
      payload: {
        name: clean.name,
        contactEmail: clean.contactEmail,
        country: clean.country,
        city: clean.city,
        tradeName: clean.tradeName ?? null,
        contactPhone: clean.contactPhone ?? null,
        address: clean.address ?? null,
        notes: clean.notes ?? null,
        status: editForm.status,
      },
    });
  };

  const columns: Column<CompanyListRow>[] = useMemo(
    () => [
      { header: t('Name', 'الاسم'), accessor: (r) => <span className="text-text-strong">{r.name}</span> },
      { header: t('Trade name', 'الاسم التجاري'), accessor: (r) => <span className="text-text-body">{r.tradeName ?? '—'}</span> },
      { header: t('Email', 'البريد الإلكتروني'), accessor: (r) => <span className="text-text-body">{r.contactEmail}</span> },
      { header: t('Phone', 'الهاتف'), accessor: (r) => <span className="text-text-body">{r.contactPhone ?? '—'}</span> },
      { header: t('City', 'المدينة'), accessor: (r) => <span className="text-text-body">{r.city ?? '—'}</span> },
      { header: t('Country', 'الدولة'), accessor: (r) => <span className="text-text-body">{r.country ?? '—'}</span> },
      {
        header: t('Billing', 'الفوترة'),
        accessor: (r) => (
          <span className="text-text-body">
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
          const busy = updateMut.isPending || createMut.isPending;
          return (
            <div className="inline-flex" onClick={(e) => e.stopPropagation()}>
              <AnchoredDropdown
                open={openActionId === r.id}
                align="end"
                menuRootProps={{ 'data-client-action-menu': 'true' }}
                trigger={
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-text-body transition hover:bg-surface-card-muted"
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
                  className="block w-full px-3 py-2 text-left text-sm text-text-body transition hover:bg-surface-card-muted"
                  data-client-action-menu-button="true"
                  onClick={() => {
                    setOpenActionId(null);
                    openEdit(r);
                  }}
                >
                  {t('Edit', 'تعديل')}
                </button>
                {r.status !== 'purged' ? (
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-text-body transition hover:bg-surface-card-muted"
                    data-client-action-menu-button="true"
                    onClick={() => {
                      setOpenActionId(null);
                      setLifecycleRow(r);
                    }}
                  >
                    {t('Manage account status', 'إدارة حالة الحساب')}
                  </button>
                ) : null}
              </AnchoredDropdown>
            </div>
          );
        },
      },
    ],
    [updateMut.isPending, createMut.isPending, openActionId, isArabic],
  );

  const errMsg = error instanceof Error ? error.message : null;
  const filteredRows = useMemo(() => {
    const q = appliedFilters.search.trim().toLowerCase();
    const statusFilter = appliedFilters.status;
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
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
  }, [rows, appliedFilters.search, appliedFilters.searchCategory, appliedFilters.status]);

  return (
    <>
      {errMsg ? <Alert variant="error" title={errMsg} className="mb-4" /> : null}

      <FilterPanel
        title={t('Client filters', 'فلاتر العملاء')}
        onApply={applyFilters}
        onReset={resetFilters}
        loading={isFetching}
        applyLabel={t('Apply filters', 'تطبيق الفلاتر')}
        resetLabel={t('Reset filters', 'إعادة تعيين الفلاتر')}
      >
          <TextField
            label={t('Search', 'بحث')}
            value={draftFilters.search}
            onChange={(e) => setDraft({ search: e.target.value })}
            placeholder={t('Search client...', 'ابحث عن عميل...')}
          />
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
          />
          <SelectField
            label={t('Status', 'الحالة')}
            name="clientStatusFilter"
            value={draftFilters.status}
            onChange={(e) => setDraft({ status: e.target.value as ClientStatusFilter })}
            options={[
              { value: 'all', label: t('All', 'الكل') },
              { value: 'active', label: t('Active', 'نشط') },
              { value: 'suspended', label: t('Suspended', 'موقوف') },
              { value: 'archived', label: t('Archived', 'مؤرشف') },
            ]}
          />
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
        <form id="create-company" onSubmit={submitCreate} className="max-h-[calc(100vh-220px)] space-y-3 overflow-y-auto pr-1" noValidate>
          <TextField
            label={t('Name', 'الاسم')}
            required
            name="name"
            value={createForm.name}
            error={createErrors.name}
            onChange={(e) => {
              setCreateForm((f) => ({ ...f, name: e.target.value }));
              setCreateErrors((err) => ({ ...err, name: undefined }));
            }}
          />
          <TextField
            label={t('Trade name (optional)', 'الاسم التجاري (اختياري)')}
            name="tradeName"
            value={createForm.tradeName ?? ''}
            error={createErrors.tradeName}
            onChange={(e) => {
              setCreateForm((f) => ({ ...f, tradeName: e.target.value }));
              setCreateErrors((err) => ({ ...err, tradeName: undefined }));
            }}
          />
          <TextField
            label={t('Contact email', 'البريد الإلكتروني للتواصل')}
            type="email"
            required
            name="contactEmail"
            value={createForm.contactEmail}
            error={createErrors.contactEmail}
            onChange={(e) => {
              setCreateForm((f) => ({ ...f, contactEmail: e.target.value }));
              setCreateErrors((err) => ({ ...err, contactEmail: undefined }));
            }}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField
              label={t('Country', 'الدولة')}
              required
              name="country"
              value={createForm.country ?? ''}
              error={createErrors.country}
              hint={t('ISO code or country name', 'رمز ISO أو اسم الدولة')}
              onChange={(e) => {
                setCreateForm((f) => ({ ...f, country: e.target.value }));
                setCreateErrors((err) => ({ ...err, country: undefined }));
              }}
            />
            <TextField
              label={t('City', 'المدينة')}
              required
              name="city"
              value={createForm.city ?? ''}
              error={createErrors.city}
              onChange={(e) => {
                setCreateForm((f) => ({ ...f, city: e.target.value }));
                setCreateErrors((err) => ({ ...err, city: undefined }));
              }}
            />
          </div>
          <TextField
            label={t('Phone (optional)', 'الهاتف (اختياري)')}
            name="contactPhone"
            value={createForm.contactPhone ?? ''}
            error={createErrors.contactPhone}
            hint={t('International format, e.g. +9665…', 'بصيغة دولية، مثال +9665…')}
            onChange={(e) => {
              setCreateForm((f) => ({ ...f, contactPhone: e.target.value }));
              setCreateErrors((err) => ({ ...err, contactPhone: undefined }));
            }}
          />
          <FieldTextarea
            id="create-address"
            label={t('Address (optional)', 'العنوان (اختياري)')}
            value={createForm.address ?? ''}
            error={createErrors.address}
            onChange={(v) => {
              setCreateForm((f) => ({ ...f, address: v }));
              setCreateErrors((err) => ({ ...err, address: undefined }));
            }}
          />
          <FieldTextarea
            id="create-notes"
            label={t('Notes (optional)', 'ملاحظات (اختياري)')}
            value={createForm.notes ?? ''}
            error={createErrors.notes}
            onChange={(v) => {
              setCreateForm((f) => ({ ...f, notes: v }));
              setCreateErrors((err) => ({ ...err, notes: undefined }));
            }}
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
        <form id="edit-company" onSubmit={submitEdit} className="space-y-3" noValidate>
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
            required
            name="edit-name"
            value={editForm.name ?? ''}
            error={editErrors.name}
            onChange={(e) => {
              setEditForm((f) => ({ ...f, name: e.target.value }));
              setEditErrors((err) => ({ ...err, name: undefined }));
            }}
          />
          <TextField
            label={t('Trade name', 'الاسم التجاري')}
            name="edit-tradeName"
            value={editForm.tradeName ?? ''}
            error={editErrors.tradeName}
            onChange={(e) => {
              setEditForm((f) => ({ ...f, tradeName: e.target.value }));
              setEditErrors((err) => ({ ...err, tradeName: undefined }));
            }}
          />
          <TextField
            label={t('Contact email', 'البريد الإلكتروني للتواصل')}
            type="email"
            required
            name="edit-contactEmail"
            value={editForm.contactEmail ?? ''}
            error={editErrors.contactEmail}
            onChange={(e) => {
              setEditForm((f) => ({ ...f, contactEmail: e.target.value }));
              setEditErrors((err) => ({ ...err, contactEmail: undefined }));
            }}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField
              label={t('Country', 'الدولة')}
              required
              name="edit-country"
              value={editForm.country ?? ''}
              error={editErrors.country}
              onChange={(e) => {
                setEditForm((f) => ({ ...f, country: e.target.value }));
                setEditErrors((err) => ({ ...err, country: undefined }));
              }}
            />
            <TextField
              label={t('City', 'المدينة')}
              required
              name="edit-city"
              value={editForm.city ?? ''}
              error={editErrors.city}
              onChange={(e) => {
                setEditForm((f) => ({ ...f, city: e.target.value }));
                setEditErrors((err) => ({ ...err, city: undefined }));
              }}
            />
          </div>
          <TextField
            label={t('Phone', 'الهاتف')}
            name="edit-phone"
            value={editForm.contactPhone ?? ''}
            error={editErrors.contactPhone}
            onChange={(e) => {
              setEditForm((f) => ({ ...f, contactPhone: e.target.value }));
              setEditErrors((err) => ({ ...err, contactPhone: undefined }));
            }}
          />
          <FieldTextarea
            id="edit-address"
            label={t('Address', 'العنوان')}
            value={editForm.address ?? ''}
            error={editErrors.address}
            onChange={(v) => {
              setEditForm((f) => ({ ...f, address: v }));
              setEditErrors((err) => ({ ...err, address: undefined }));
            }}
          />
          <FieldTextarea
            id="edit-notes"
            label={t('Notes', 'ملاحظات')}
            value={editForm.notes ?? ''}
            error={editErrors.notes}
            onChange={(v) => {
              setEditForm((f) => ({ ...f, notes: v }));
              setEditErrors((err) => ({ ...err, notes: undefined }));
            }}
          />
        </form>
      </Modal>

      <CustomerLifecycleModal
        company={lifecycleRow}
        isSuperAdmin={isSuperAdmin}
        onClose={() => setLifecycleRow(null)}
      />
    </>
  );
}
