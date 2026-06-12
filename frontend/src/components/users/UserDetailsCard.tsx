import type { ReactNode } from 'react';

import type { UserListRow } from '../../api/users';
import { workerProfileStatusText } from '../../lib/worker-profile';

function display(v: string | null | undefined): string {
  if (v == null || v === '') return '—';
  return v;
}

function prettyDate(iso: string | null | undefined): string {
  if (iso == null || iso === '') return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

function roleLabel(role: UserListRow['role']): string {
  const map: Record<UserListRow['role'], string> = {
    super_admin: 'Super admin',
    wh_manager: 'Admin',
    wh_operator: 'Worker',
    finance: 'Finance',
    client_admin: 'Client admin',
    client_staff: 'Client staff',
  };
  return map[role] ?? role;
}

function UserDetailField({
  iconClass,
  label,
  value,
}: {
  iconClass: string;
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <i className={`${iconClass} text-[11px] text-emerald-600/90`} aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className="mt-1.5 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function activityPill(u: UserListRow) {
  const online =
    u.status === 'active' &&
    u.lastActivityAt != null &&
    Date.now() - new Date(u.lastActivityAt).getTime() < 5 * 60 * 1000;
  const cls = online
    ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
    : 'bg-slate-100 text-slate-600 ring-slate-200';
  const label = u.status !== 'active' ? 'Offline' : online ? 'Online' : 'Offline';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls}`}>
      {label}
    </span>
  );
}

function statusPill(status: string) {
  const active = status === 'active';
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${
        active ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-slate-200'
      }`}
    >
      {status}
    </span>
  );
}

export function UserDetailsCard({
  user,
  variant,
}: {
  user: UserListRow;
  variant: 'warehouse' | 'client';
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-50 to-slate-50 ring-4 ring-slate-50"
          aria-hidden="true"
        >
          <i
            className={`fa-solid ${variant === 'warehouse' ? 'fa-user-gear' : 'fa-user'} text-xl text-emerald-600/80`}
          />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="text-lg font-semibold leading-tight text-slate-900">{user.fullName}</h2>
          <p className="mt-1 text-sm text-slate-500">{user.email}</p>
        </div>
      </div>

      <h3 className="mt-6 text-sm font-semibold text-slate-800">User information</h3>
      <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <UserDetailField iconClass="fa-solid fa-id-badge" label="Role" value={roleLabel(user.role)} />
        <UserDetailField iconClass="fa-solid fa-circle-check" label="Status" value={statusPill(user.status)} />
        <UserDetailField iconClass="fa-solid fa-phone" label="Phone" value={display(user.phone)} />
        <UserDetailField iconClass="fa-solid fa-signal" label="Activity" value={activityPill(user)} />
        <UserDetailField iconClass="fa-solid fa-clock" label="Last login" value={prettyDate(user.lastLoginAt)} />
        {variant === 'client' ? (
          <UserDetailField iconClass="fa-solid fa-building" label="Company" value={display(user.companyName)} />
        ) : (
          <>
            <UserDetailField
              iconClass="fa-solid fa-warehouse"
              label="Account type"
              value="Warehouse (system)"
            />
            {user.role === 'wh_operator' ? (
              <UserDetailField
                iconClass="fa-solid fa-id-card"
                label="Worker profile"
                value={workerProfileStatusText(user.workerProfile, user.status, (en) => en)}
              />
            ) : null}
          </>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Created {prettyDate(user.createdAt)} · Updated {prettyDate(user.updatedAt)}
      </p>
    </section>
  );
}
