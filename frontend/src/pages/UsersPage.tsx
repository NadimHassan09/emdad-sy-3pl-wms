import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { CompaniesApi } from '../api/companies';
import { WarehousesApi } from '../api/warehouses';
import {
  UsersApi,
  type CreateUserPayload,
  type UpdateUserPayload,
  type UserListRow,
  type UserRole,
  type UserStatus,
} from '../api/users';
import { Button } from '../components/Button';
import { Combobox } from '../components/Combobox';
import { DataTable, type Column } from '../components/DataTable';
import { FilterPanel } from '../components/FilterPanel';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { SelectField } from '../components/SelectField';
import { TextField } from '../components/TextField';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';

const KIND_OPTIONS = [
  { value: 'system', label: 'System user' },
  { value: 'client', label: 'Client user' },
];

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

/** Consider a user "online" if we saw authenticated API activity within this window. */
const ONLINE_IDLE_MS = 5 * 60 * 1000;

function formatLastLogin(iso: string | null | undefined): string {
  if (iso == null || iso === '') return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

function activityPill(u: UserListRow) {
  if (u.status !== 'active') {
    return (
      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase bg-slate-100 text-slate-600">
        Offline
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

export function UsersPage() {
  const isArabic =
    typeof window !== 'undefined' && (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const qc = useQueryClient();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserListRow | null>(null);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [kind, setKind] = useState<'system' | 'client'>('system');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [systemRole, setSystemRole] = useState<'super_admin' | 'admin' | 'worker'>('worker');
  const [clientRole, setClientRole] = useState<'client_admin' | 'client_staff'>('client_staff');
  const [companyId, setCompanyId] = useState('');
  const [workerWarehouseId, setWorkerWarehouseId] = useState('');

  const [editEmail, setEditEmail] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('wh_operator');
  const [editStatus, setEditStatus] = useState<UserStatus>('active');
  const [editCompanyId, setEditCompanyId] = useState('');
  const [systemSearch, setSystemSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [systemRoleFilter, setSystemRoleFilter] = useState('');
  const [clientRoleFilter, setClientRoleFilter] = useState('');

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

  const usersQuery = useQuery({
    queryKey: QK.users,
    queryFn: () => UsersApi.list({ kind: 'all' }),
    refetchInterval: 45_000,
  });

  const companiesQuery = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list({ includeAll: false }),
    enabled: createOpen || !!editUser,
  });

  const warehousesQuery = useQuery({
    queryKey: [...QK.warehouses, false, 'users-modal'],
    queryFn: () => WarehousesApi.list(false),
    enabled: createOpen && kind === 'system' && systemRole === 'worker',
  });

  const resetCreateForm = useCallback(() => {
    setKind('system');
    setEmail('');
    setFullName('');
    setPhone('');
    setPassword('');
    setSystemRole('worker');
    setClientRole('client_staff');
    setCompanyId('');
    setWorkerWarehouseId('');
  }, []);

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
      void qc.invalidateQueries({ queryKey: QK.users });
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
      void qc.invalidateQueries({ queryKey: QK.users });
      void qc.invalidateQueries({ queryKey: QK.workers.all });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const suspendMut = useMutation({
    mutationFn: (id: string) => UsersApi.suspend(id),
    onSuccess: () => {
      toast.success('User suspended.');
      setOpenActionId(null);
      void qc.invalidateQueries({ queryKey: QK.users });
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
      void qc.invalidateQueries({ queryKey: QK.users });
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
        accessor: (u) => activityPill(u),
      },
      {
        header: t('Actions', 'الإجراءات'),
        className: 'min-w-[120px] text-right',
        accessor: (u) => {
          const menuOpen = openActionId === u.id;
          return (
            <div className="relative inline-flex">
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-100"
                disabled={busy}
                data-user-action-trigger="true"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenActionId((cur) => (cur === u.id ? null : u.id));
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
                    data-user-action-menu-button="true"
                    onClick={(e) => {
                      e.stopPropagation();
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
                      onClick={(e) => {
                        e.stopPropagation();
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
                    onClick={(e) => {
                      e.stopPropagation();
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
                </div>
              ) : null}
            </div>
          );
        },
      },
    ];
    return {
      systemColumns: [...lead, ...tail],
      clientColumns: [...lead, companyCol, ...tail],
    };
  }, [busy, openEdit, suspendMut.isPending, removeMut.isPending, openActionId, isArabic]);

  const closeCreate = () => {
    if (!createMut.isPending) {
      resetCreateForm();
      setCreateOpen(false);
    }
  };

  const systemUsers = useMemo(
    () =>
      (usersQuery.data ?? [])
        .filter((u) => u.kind === 'system')
        .filter((u) => {
          const q = systemSearch.trim().toLowerCase();
          if (q) {
            const name = u.fullName?.toLowerCase() ?? '';
            const email = u.email?.toLowerCase() ?? '';
            if (!name.includes(q) && !email.includes(q)) return false;
          }
          if (systemRoleFilter && u.role !== systemRoleFilter) return false;
          return true;
        }),
    [usersQuery.data, systemSearch, systemRoleFilter],
  );
  const clientUsers = useMemo(
    () =>
      (usersQuery.data ?? [])
        .filter((u) => u.kind === 'client')
        .filter((u) => {
          const q = clientSearch.trim().toLowerCase();
          if (q) {
            const name = u.fullName?.toLowerCase() ?? '';
            const email = u.email?.toLowerCase() ?? '';
            if (!name.includes(q) && !email.includes(q)) return false;
          }
          if (clientRoleFilter && u.role !== clientRoleFilter) return false;
          return true;
        }),
    [usersQuery.data, clientSearch, clientRoleFilter],
  );

  const submitCreate = (e: FormEvent) => {
    e.preventDefault();
    const base = {
      email: email.trim(),
      fullName: fullName.trim(),
      phone: phone.trim() || undefined,
      password,
    };
    if (kind === 'system') {
      const payload: CreateUserPayload = {
        ...base,
        kind: 'system',
        systemRole,
        ...(systemRole === 'worker' && workerWarehouseId.trim()
          ? { workerWarehouseId: workerWarehouseId.trim() }
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

  const errMsg = usersQuery.error instanceof Error ? usersQuery.error.message : null;

  return (
    <>
      <PageHeader
        title={t('Users', 'المستخدمون')}
        actions={
          <Button
            type="button"
            className="border border-[#1a7a44] bg-[#1a7a44] text-white hover:bg-[#146135]"
            onClick={() => setCreateOpen(true)}
          >
            {t('+ New user', '+ مستخدم جديد')}
          </Button>
        }
      />

      {errMsg ? <p className="mb-4 text-sm text-rose-600">{errMsg}</p> : null}

      <div className="space-y-8">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t('System users', 'مستخدمو النظام')}</h2>
          <FilterPanel showLabel={t('Show filters', 'إظهار الفلاتر')} hideLabel={t('Hide filters', 'إخفاء الفلاتر')}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <TextField
                label={t('Search', 'بحث')}
                value={systemSearch}
                onChange={(e) => setSystemSearch(e.target.value)}
                placeholder={t('Search by name or email', 'ابحث بالاسم أو البريد الإلكتروني')}
              />
              <SelectField
                label={t('Role', 'الدور')}
                name="systemRoleFilter"
                value={systemRoleFilter}
                onChange={(e) => setSystemRoleFilter(e.target.value)}
                options={[
                  { value: '', label: t('All roles', 'كل الأدوار') },
                  ...SYSTEM_ROLE_EDIT.map((r) => ({ value: r.value, label: r.label })),
                ]}
              />
            </div>
          </FilterPanel>
          <DataTable
            columns={systemColumns}
            rows={systemUsers}
            rowKey={(u) => u.id}
            loading={usersQuery.isLoading}
            empty={t('No system users yet.', 'لا يوجد مستخدمو نظام بعد.')}
            labels={{
              rowsSuffix: t('rows', 'صف'),
              resultsSuffix: t('results', 'نتيجة'),
              ofWord: t('of', 'من'),
              previous: t('Previous', 'السابق'),
              next: t('Next', 'التالي'),
              rowsPerPageAria: t('Rows per page', 'عدد الصفوف لكل صفحة'),
            }}
          />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t('Client users', 'مستخدمو العملاء')}</h2>
          <FilterPanel showLabel={t('Show filters', 'إظهار الفلاتر')} hideLabel={t('Hide filters', 'إخفاء الفلاتر')}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <TextField
                label={t('Search', 'بحث')}
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder={t('Search by name or email', 'ابحث بالاسم أو البريد الإلكتروني')}
              />
              <SelectField
                label={t('Role', 'الدور')}
                name="clientRoleFilter"
                value={clientRoleFilter}
                onChange={(e) => setClientRoleFilter(e.target.value)}
                options={[
                  { value: '', label: t('All roles', 'كل الأدوار') },
                  ...CLIENT_ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label })),
                ]}
              />
            </div>
          </FilterPanel>
          <DataTable
            columns={clientColumns}
            rows={clientUsers}
            rowKey={(u) => u.id}
            loading={usersQuery.isLoading}
            empty={t('No client users yet.', 'لا يوجد مستخدمو عملاء بعد.')}
            labels={{
              rowsSuffix: t('rows', 'صف'),
              resultsSuffix: t('results', 'نتيجة'),
              ofWord: t('of', 'من'),
              previous: t('Previous', 'السابق'),
              next: t('Next', 'التالي'),
              rowsPerPageAria: t('Rows per page', 'عدد الصفوف لكل صفحة'),
            }}
          />
        </section>
      </div>

      <Modal
        open={createOpen}
        onClose={closeCreate}
        title={t('New user', 'مستخدم جديد')}
        widthClass="max-w-lg"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeCreate} disabled={createMut.isPending}>
              {t('Cancel', 'إلغاء')}
            </Button>
            <Button
              type="submit"
              form="create-user"
              loading={createMut.isPending}
              className="border border-[#1a7a44] bg-[#1a7a44] text-white hover:bg-[#146135]"
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
          <SelectField
            label={t('User type', 'نوع المستخدم')}
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as 'system' | 'client')}
            options={KIND_OPTIONS}
          />
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
            hint={t('Minimum 8 characters. Stored hashed on the server.', '8 أحرف على الأقل. تُخزن مشفرة على الخادم.')}
          />
          {kind === 'system' ? (
            <>
              <SelectField
                label={t('System role', 'دور النظام')}
                name="systemRole"
                value={systemRole}
                onChange={(e) => {
                  const v = e.target.value as typeof systemRole;
                  setSystemRole(v);
                  if (v !== 'worker') setWorkerWarehouseId('');
                }}
                options={SYSTEM_ROLE_OPTIONS}
              />
              {systemRole === 'worker' ? (
                <Combobox
                  label={t('Default warehouse (optional)', 'المستودع الافتراضي (اختياري)')}
                  value={workerWarehouseId}
                  onChange={setWorkerWarehouseId}
                  options={(warehousesQuery.data ?? []).map((w) => ({
                    value: w.id,
                    label: w.name,
                    hint: w.code,
                  }))}
                  placeholder={t('Any warehouse…', 'أي مستودع…')}
                  emptyMessage={t('No warehouses loaded.', 'لا توجد مستودعات محملة.')}
                  hint={t('Stored on the worker profile. Requires a tenant session (X-Company-Id).', 'يُخزن في ملف العامل. يتطلب جلسة مستأجر (X-Company-Id).')}
                />
              ) : null}
            </>
          ) : (
            <>
              <Combobox
                label={t('Company', 'الشركة')}
                required
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
              <Button type="button" variant="secondary" onClick={closeEdit} disabled={updateMut.isPending}>
                {t('Cancel', 'إلغاء')}
              </Button>
              <Button type="submit" form="edit-user" loading={updateMut.isPending}>
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
          </form>
        </Modal>
      )}
    </>
  );
}
