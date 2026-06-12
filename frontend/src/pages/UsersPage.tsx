import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { CompaniesApi } from '../api/companies';
import {
  UsersApi,
  type CreateUserPayload,
  type UpdateUserPayload,
  type UserListRow,
  type UserRole,
  type UserStatus,
} from '../api/users';
import { AnchoredDropdown } from '../components/AnchoredDropdown';
import { Button } from '../components/Button';
import { Combobox } from '../components/Combobox';
import { DataTable, type Column } from '../components/DataTable';
import { FilterPanel } from '../components/FilterPanel';
import { Modal } from '../components/Modal';
import { SelectField } from '../components/SelectField';
import { TextField } from '../components/TextField';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import { useDefaultWarehouseId } from '../hooks/useDefaultWarehouse';
import { useFilters } from '../hooks/useFilters';
import { useServerPagination } from '../hooks/useServerPagination';
import { useTenantCompanyId } from '../hooks/useTenantCompanyId';
import { WorkerProfilePanel } from '../components/users/WorkerProfilePanel';
import { MODAL_CANCEL_BUTTON_CLASS } from '../lib/modal-button-styles';
import { workerProfileStatusText } from '../lib/worker-profile';

type UserListFilters = {
  search: string;
  role: string;
};

export type UsersPageVariant = 'warehouse' | 'client';

function variantToApiKind(variant: UsersPageVariant): 'system' | 'client' {
  return variant === 'warehouse' ? 'system' : 'client';
}

const SYSTEM_ROLE_OPTIONS = [
  { value: 'super_admin', label: 'Super admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'worker', label: 'Worker' },
];

const SYSTEM_ROLE_EDIT = [
  { value: 'super_admin', label: 'Super admin' },
  { value: 'wh_manager', label: 'Admin' },
  { value: 'wh_operator', label: 'Worker' },
  { value: 'finance', label: 'Finance' },
];

const CLIENT_ROLE_OPTIONS = [
  { value: 'client_admin', label: 'Client admin' },
  { value: 'client_staff', label: 'Client staff' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const USERS_PAGE_SIZE = 20;
const USERS_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

/** Consider a user "online" if we saw authenticated API activity within this window. */
const ONLINE_IDLE_MS = 5 * 60 * 1000;

function formatLastLogin(iso: string | null | undefined): string {
  if (iso == null || iso === '') return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

function activityPill(u: UserListRow, onlineUserIds?: Set<string>) {
  if (u.status !== 'active') {
    return (
      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase bg-slate-100 text-slate-600">
        Offline
      </span>
    );
  }
  if (onlineUserIds?.has(u.id)) {
    return (
      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase bg-emerald-50 text-emerald-700">
        Online
      </span>
    );
  }
  const iso = u.lastActivityAt;
  if (iso == null || iso === '') {
    return (
      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase bg-slate-100 text-slate-600">
        Offline
      </span>
    );
  }
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) {
    return (
      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase bg-slate-100 text-slate-600">
        Offline
      </span>
    );
  }
  const online = Date.now() - t < ONLINE_IDLE_MS;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
        online ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {online ? 'Online' : 'Offline'}
    </span>
  );
}

function roleLabel(role: UserRole): string {
  const map: Record<UserRole, string> = {
    super_admin: 'Super admin',
    wh_manager: 'Admin',
    wh_operator: 'Worker',
    finance: 'Finance',
    client_admin: 'Client admin',
    client_staff: 'Client staff',
  };
  return map[role] ?? role;
}

function statusPill(status: string) {
  const active = status === 'active';
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
        active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {status}
    </span>
  );
}

function UsersPageContent({ variant }: { variant: UsersPageVariant }) {
  const navigate = useNavigate();
  const apiKind = variantToApiKind(variant);
  const { warehouseId: defaultWarehouseId } = useDefaultWarehouseId();
  const tenantCompanyId = useTenantCompanyId();
  const isArabic =
    typeof window !== 'undefined' && (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const qc = useQueryClient();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserListRow | null>(null);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [kind, setKind] = useState<'system' | 'client'>(apiKind);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [systemRole, setSystemRole] = useState<'super_admin' | 'admin' | 'worker'>('worker');
  const [clientRole, setClientRole] = useState<'client_admin' | 'client_staff'>('client_staff');
  const [companyId, setCompanyId] = useState('');

  const [editEmail, setEditEmail] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('wh_operator');
  const [editStatus, setEditStatus] = useState<UserStatus>('active');
  const [editCompanyId, setEditCompanyId] = useState('');
  const initialUserFilters = useMemo<UserListFilters>(() => ({ search: '', role: '' }), []);
  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters(initialUserFilters);

  useEffect(() => {
    if (!openActionId) return;
    const onPointerDown = (ev: PointerEvent) => {
      const target = ev.target as Element | null;
      if (!target) return;
      if (
        target.closest('[data-user-action-trigger="true"]') ||
        target.closest('[data-user-action-menu-button="true"]')
      ) {
        return;
      }
      setOpenActionId(null);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [openActionId]);

  const listParams = useMemo(
    () => ({
      kind: apiKind,
      search: appliedFilters.search.trim() || undefined,
      role: (appliedFilters.role as UserRole) || undefined,
      companyId: tenantCompanyId || undefined,
    }),
    [apiKind, appliedFilters.search, appliedFilters.role, tenantCompanyId],
  );

  const pagination = useServerPagination<UserListRow>({
    filterKey: listParams,
    queryKey: QK.users.list(listParams),
    fetchPage: (offset, limit) => UsersApi.list({ ...listParams, offset, limit }),
    defaultPageSize: USERS_PAGE_SIZE,
    pageSizeOptions: USERS_PAGE_SIZE_OPTIONS,
  });

  const presenceQuery = useQuery({
    queryKey: QK.presenceOnlineUsers,
    queryFn: () => new Set<string>(),
    staleTime: Infinity,
    initialData: () => new Set<string>(),
  });
  const onlineUserIds = presenceQuery.data;

  const companiesQuery = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list({ includeAll: false }),
    enabled: createOpen || !!editUser,
  });

  const resetCreateForm = useCallback(() => {
    setKind(apiKind);
    setEmail('');
    setFullName('');
    setPhone('');
    setPassword('');
    setSystemRole('worker');
    setClientRole('client_staff');
    setCompanyId('');
  }, [apiKind]);

  const openEdit = useCallback((u: UserListRow) => {
    setEditUser(u);
    setEditEmail(u.email);
    setEditFullName(u.fullName);
    setEditPhone(u.phone ?? '');
    setEditPassword('');
    setEditRole(u.role);
    setEditStatus(u.status);
    setEditCompanyId(u.companyId ?? '');
  }, []);

  const closeEdit = useCallback(() => {
    setEditUser(null);
    setEditPassword('');
  }, []);

  const createMut = useMutation({
    mutationFn: (payload: CreateUserPayload) => UsersApi.create(payload),
    onSuccess: () => {
      toast.success('User created.');
      setCreateOpen(false);
      resetCreateForm();
      setOpenActionId(null);
      void qc.invalidateQueries({ queryKey: ['users', 'list'], exact: false });
      void qc.invalidateQueries({ queryKey: QK.workers.all });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateUserPayload }) => UsersApi.update(id, body),
    onSuccess: () => {
      toast.success('User saved.');
      closeEdit();
      setOpenActionId(null);
      void qc.invalidateQueries({ queryKey: ['users', 'list'], exact: false });
      void qc.invalidateQueries({ queryKey: QK.workers.all });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const suspendMut = useMutation({
    mutationFn: (id: string) => UsersApi.suspend(id),
    onSuccess: () => {
      toast.success('User suspended.');
      setOpenActionId(null);
      void qc.invalidateQueries({ queryKey: ['users', 'list'], exact: false });
      void qc.invalidateQueries({ queryKey: QK.workers.all });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => UsersApi.remove(id),
    onSuccess: () => {
      toast.success('User deleted.');
      closeEdit();
      setOpenActionId(null);
      void qc.invalidateQueries({ queryKey: ['users', 'list'], exact: false });
      void qc.invalidateQueries({ queryKey: QK.workers.all });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const busy =
    createMut.isPending ||
    updateMut.isPending ||
    suspendMut.isPending ||
    removeMut.isPending;

  const { systemColumns, clientColumns } = useMemo(() => {
    const lead: Column<UserListRow>[] = [
      { header: t('Email', 'البريد الإلكتروني'), accessor: (u) => <span className="text-slate-800">{u.email}</span> },
      { header: t('Name', 'الاسم'), accessor: (u) => <span className="text-slate-700">{u.fullName}</span> },
      { header: t('Phone', 'الهاتف'), accessor: (u) => <span className="text-slate-600">{u.phone ?? '—'}</span> },
      {
        header: t('Role', 'الدور'),
        accessor: (u) => <span className="text-slate-700">{roleLabel(u.role)}</span>,
      },
      {
        header: t('Status', 'الحالة'),
        accessor: (u) => statusPill(u.status),
      },
      {
        header: t('Worker profile', 'ملف العامل'),
        accessor: (u) => {
          if (u.role !== 'wh_operator') return <span className="text-slate-400">—</span>;
          const label = workerProfileStatusText(u.workerProfile, u.status, t);
          const cls =
            label === t('Linked', 'مرتبط')
              ? 'bg-emerald-50 text-emerald-700'
              : label === t('Not linked', 'غير مرتبط')
                ? 'bg-amber-50 text-amber-800'
                : 'bg-slate-100 text-slate-600';
          return (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${cls}`}>
              {label}
            </span>
          );
        },
        width: '120px',
      },
    ];
    const companyCol: Column<UserListRow> = {
      header: t('Company', 'الشركة'),
      accessor: (u) => <span className="text-slate-600">{u.companyName ?? '—'}</span>,
    };
    const tail: Column<UserListRow>[] = [
      {
        header: t('Last login', 'آخر تسجيل دخول'),
        accessor: (u) => <span className="text-slate-500">{formatLastLogin(u.lastLoginAt)}</span>,
      },
      {
        header: t('Activity', 'النشاط'),
        accessor: (u) => activityPill(u, onlineUserIds),
      },
      {
        header: t('Actions', 'الإجراءات'),
        className: 'min-w-[120px] text-right',
        accessor: (u) => {
          return (
            <div className="inline-flex" onClick={(e) => e.stopPropagation()}>
              <AnchoredDropdown
                open={openActionId === u.id}
                align="end"
                menuRootProps={{ 'data-user-action-menu': 'true' }}
                trigger={
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-100"
                    disabled={busy}
                    data-user-action-trigger="true"
                    onClick={() => setOpenActionId((cur) => (cur === u.id ? null : u.id))}
                    aria-label="Open actions"
                    aria-expanded={openActionId === u.id}
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
                  data-user-action-menu-button="true"
                  onClick={() => {
                    setOpenActionId(null);
                    openEdit(u);
                  }}
                >
                  Edit
                </button>
                {u.status === 'active' ? (
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                    data-user-action-menu-button="true"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Suspend "${u.email}"? They will not be able to sign in or appear in task assignment.`,
                        )
                      ) {
                        suspendMut.mutate(u.id);
                      }
                    }}
                  >
                    Suspend
                  </button>
                ) : null}
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-rose-700 transition hover:bg-rose-50"
                  data-user-action-menu-button="true"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Permanently delete "${u.email}"? This fails if the user still has related orders, ledger rows, or task history.`,
                      )
                    ) {
                      removeMut.mutate(u.id);
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
    ];
    return {
      systemColumns: [...lead, ...tail],
      clientColumns: [...lead, companyCol, ...tail],
    };
  }, [busy, openEdit, suspendMut.isPending, removeMut.isPending, openActionId, isArabic, onlineUserIds]);

  const closeCreate = () => {
    if (!createMut.isPending) {
      resetCreateForm();
      setCreateOpen(false);
    }
  };

  const tableColumns = variant === 'warehouse' ? systemColumns : clientColumns;
  const pageTitle =
    variant === 'warehouse'
      ? t('Warehouse users', 'مستخدمو المستودع')
      : t('Client users', 'مستخدمو العملاء');
  const filterTitle =
    variant === 'warehouse'
      ? t('Warehouse user filters', 'فلاتر مستخدمي المستودع')
      : t('Client user filters', 'فلاتر مستخدمي العملاء');
  const emptyMessage =
    variant === 'warehouse'
      ? t('No warehouse users yet.', 'لا يوجد مستخدمو مستودع بعد.')
      : t('No client users yet.', 'لا يوجد مستخدمو عملاء بعد.');

  const submitCreate = (e: FormEvent) => {
    e.preventDefault();
    const base = {
      email: email.trim(),
      fullName: fullName.trim(),
      phone: phone.trim() || undefined,
      password,
    };
    if (kind === 'system') {
      if (systemRole === 'worker' && !tenantCompanyId) {
        toast.error(
          t(
            'Select an active client tenant before creating a warehouse operator. Worker profiles are provisioned per tenant.',
            'اختر عميلاً نشطاً قبل إنشاء مشغل مستودع. تُنشأ ملفات العمال لكل عميل.',
          ),
        );
        return;
      }
      const payload: CreateUserPayload = {
        ...base,
        kind: 'system',
        systemRole,
        ...(systemRole === 'worker' && defaultWarehouseId
          ? { workerWarehouseId: defaultWarehouseId }
          : {}),
      };
      createMut.mutate(payload);
      return;
    }
    if (!companyId) {
      toast.error('Select a company for the client user.');
      return;
    }
    const payload: CreateUserPayload = {
      ...base,
      kind: 'client',
      companyId,
      clientRole,
    };
    createMut.mutate(payload);
  };

  const submitEdit = (e: FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    const body: UpdateUserPayload = {
      email: editEmail.trim(),
      fullName: editFullName.trim(),
      role: editRole,
      status: editStatus,
    };
    const ph = editPhone.trim();
    if (ph) body.phone = ph;
    if (editPassword.trim()) {
      body.password = editPassword;
    }
    if (editUser.kind === 'client' && editCompanyId) {
      body.companyId = editCompanyId;
    }
    updateMut.mutate({ id: editUser.id, body });
  };

  const errMsg = pagination.error instanceof Error ? pagination.error.message : null;

  return (
    <>
      {errMsg ? <p className="mb-4 text-sm text-rose-600">{errMsg}</p> : null}

      <FilterPanel
        title={filterTitle}
        onApply={applyFilters}
        onReset={resetFilters}
        loading={pagination.isFetching}
        applyLabel={t('Apply filters', 'تطبيق الفلاتر')}
        resetLabel={t('Reset filters', 'إعادة تعيين الفلاتر')}
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full min-w-[10rem] max-w-[25%] flex-1 basis-32">
            <TextField
              label={t('Search', 'بحث')}
              value={draftFilters.search}
              onChange={(e) => setDraft({ search: e.target.value })}
              placeholder={t('Search by name or email', 'ابحث بالاسم أو البريد الإلكتروني')}
            />
          </div>
          <div className="w-full min-w-[10rem] max-w-[25%] flex-1 basis-32">
            <SelectField
              label={t('Role', 'الدور')}
              name="roleFilter"
              value={draftFilters.role}
              onChange={(e) => setDraft({ role: e.target.value })}
              options={[
                { value: '', label: t('All roles', 'كل الأدوار') },
                ...(variant === 'warehouse'
                  ? SYSTEM_ROLE_EDIT.map((r) => ({ value: r.value, label: r.label }))
                  : CLIENT_ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))),
              ]}
            />
          </div>
        </div>
      </FilterPanel>

      <DataTable
        title={pageTitle}
        actions={
          <Button
            type="button"
            variant="brand"
            onClick={() => {
              resetCreateForm();
              setCreateOpen(true);
            }}
          >
            {t('+ New user', '+ مستخدم جديد')}
          </Button>
        }
        columns={tableColumns}
        rows={pagination.rows}
        rowKey={(u) => u.id}
        onRowClick={(u) =>
          navigate(variant === 'warehouse' ? `/users/warehouse_users/${u.id}` : `/users/client_users/${u.id}`)
        }
        loading={pagination.isInitialLoading}
        empty={emptyMessage}
        serverPagination={pagination.serverPagination}
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
        title={t('New user', 'مستخدم جديد')}
        widthClass="max-w-lg"
        footer={
          <>
            <Button
              type="button"
              variant="danger"
              className={MODAL_CANCEL_BUTTON_CLASS}
              onClick={closeCreate}
              disabled={createMut.isPending}
            >
              {t('Cancel', 'إلغاء')}
            </Button>
            <Button
              type="submit"
              form="create-user"
              variant="brand"
              loading={createMut.isPending}
            >
              {t('Create', 'إنشاء')}
            </Button>
          </>
        }
      >
        <form
          id="create-user"
          onSubmit={submitCreate}
          className="max-h-[calc(100vh-220px)] space-y-3 overflow-y-auto pr-1"
        >
          <TextField
            label={t('Email', 'البريد الإلكتروني')}
            type="email"
            name="email"
            required
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label={t('Full name', 'الاسم الكامل')}
            name="fullName"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <TextField
            label={t('Phone (optional)', 'الهاتف (اختياري)')}
            name="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <TextField
            label={t('Password', 'كلمة المرور')}
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint={t('Minimum 8 characters.', '8 أحرف على الأقل.')}
          />
          {kind === 'system' ? (
            <>
              <SelectField
                label={t('System role', 'دور النظام')}
                name="systemRole"
                value={systemRole}
                onChange={(e) => setSystemRole(e.target.value as typeof systemRole)}
                options={SYSTEM_ROLE_OPTIONS}
              />
              {systemRole === 'worker' && !tenantCompanyId ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                  {t(
                    'An active client tenant is required. The operator will get a worker profile in that tenant for tasks and cycle counts.',
                    'مطلوب عميل نشط. سيحصل المشغل على ملف عامل في ذلك العميل للمهام والجرد.',
                  )}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <Combobox
                label={t('Company', 'الشركة')}
                required
                dropdownInFlow
                value={companyId}
                onChange={setCompanyId}
                options={(companiesQuery.data ?? []).map((c) => ({
                  value: c.id,
                  label: c.name,
                  hint: c.contactEmail,
                }))}
                placeholder={t('Search company…', 'ابحث عن شركة…')}
                emptyMessage={t('No companies match.', 'لا توجد شركات مطابقة.')}
              />
              <SelectField
                label={t('Client role', 'دور العميل')}
                name="clientRole"
                value={clientRole}
                onChange={(e) => setClientRole(e.target.value as typeof clientRole)}
                options={CLIENT_ROLE_OPTIONS}
              />
            </>
          )}
        </form>
      </Modal>

      {editUser && (
        <Modal
          open
          onClose={() => !updateMut.isPending && closeEdit()}
          title={`${t('Edit', 'تعديل')} ${editUser.email}`}
          widthClass="max-w-lg"
          footer={
            <>
              <Button
                type="button"
                variant="danger"
                className={MODAL_CANCEL_BUTTON_CLASS}
                onClick={closeEdit}
                disabled={updateMut.isPending}
              >
                {t('Cancel', 'إلغاء')}
              </Button>
              <Button
                type="submit"
                form="edit-user"
                variant="brand"
                loading={updateMut.isPending}
              >
                {t('Save', 'حفظ')}
              </Button>
            </>
          }
        >
          <form id="edit-user" onSubmit={submitEdit} className="space-y-3">
            <TextField
              label={t('Email', 'البريد الإلكتروني')}
              type="email"
              name="edit-email"
              required
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
            />
            <TextField
              label={t('Full name', 'الاسم الكامل')}
              name="edit-fullName"
              required
              value={editFullName}
              onChange={(e) => setEditFullName(e.target.value)}
            />
            <TextField
              label={t('Phone', 'الهاتف')}
              name="edit-phone"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
            />
            <SelectField
              label={t('Status', 'الحالة')}
              name="edit-status"
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as UserStatus)}
              options={STATUS_OPTIONS}
            />
            <SelectField
              label={editUser.kind === 'system' ? t('System role', 'دور النظام') : t('Client role', 'دور العميل')}
              name="edit-role"
              value={editRole}
              onChange={(e) => setEditRole(e.target.value as UserRole)}
              options={editUser.kind === 'system' ? SYSTEM_ROLE_EDIT : CLIENT_ROLE_OPTIONS}
            />
            {editUser.kind === 'client' ? (
              <Combobox
                label="Company"
                required
                dropdownInFlow
                value={editCompanyId}
                onChange={setEditCompanyId}
                options={(companiesQuery.data ?? []).map((c) => ({
                  value: c.id,
                  label: c.name,
                  hint: c.contactEmail,
                }))}
                placeholder={t('Search company…', 'ابحث عن شركة…')}
                emptyMessage={t('No companies match.', 'لا توجد شركات مطابقة.')}
              />
            ) : null}
            <TextField
              label={t('New password (optional)', 'كلمة مرور جديدة (اختياري)')}
              type="password"
              name="edit-password"
              autoComplete="new-password"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
              hint={t('Leave blank to keep the current password.', 'اتركه فارغا للاحتفاظ بكلمة المرور الحالية.')}
            />
            {editUser.kind === 'system' && editRole === 'wh_operator' ? (
              <div className="border-t border-slate-100 pt-2">
                <WorkerProfilePanel
                  user={{ ...editUser, role: editRole, status: editStatus }}
                  t={t}
                  compact
                />
              </div>
            ) : null}
          </form>
        </Modal>
      )}
    </>
  );
}

export function WarehouseUsersPage() {
  return <UsersPageContent variant="warehouse" />;
}

export function ClientUsersPage() {
  return <UsersPageContent variant="client" />;
}
