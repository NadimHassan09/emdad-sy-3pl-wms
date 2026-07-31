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
      <div className="flex items-center gap-1.5 text-xs font-medium text-text-muted">
        <i className={`${iconClass} text-[11px] text-status-success-fg/90`} aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className="mt-1.5 text-sm font-semibold text-text-strong">{value}</div>
    </div>
  );
}

function activityPill(u: UserListRow) {
  const online =
    u.status === 'active' &&
    u.lastActivityAt != null &&
    Date.now() - new Date(u.lastActivityAt).getTime() < 5 * 60 * 1000;
  const cls = online
    ? 'bg-status-success-bg text-status-success-fg ring-status-success-border'
    : 'bg-surface-card-muted text-text-body ring-border';
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
        active ? 'bg-status-success-bg text-status-success-fg ring-status-success-border' : 'bg-surface-card-muted text-text-body ring-border'
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
    <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-card p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-50 to-surface-sunken ring-4 ring-surface-sunken dark:from-white/10"
          aria-hidden="true"
        >
          <i
            className={`fa-solid ${variant === 'warehouse' ? 'fa-user-gear' : 'fa-user'} text-xl text-status-success-fg/80`}
          />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="text-lg font-semibold leading-tight text-text-strong">{user.fullName}</h2>
          <p className="mt-1 text-sm text-text-muted">{user.email}</p>
        </div>
      </div>

      <h3 className="mt-6 text-sm font-semibold text-text-strong">User information</h3>
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

      <p className="mt-4 text-xs text-text-muted">
        Created {prettyDate(user.createdAt)} · Updated {prettyDate(user.updatedAt)}
      </p>
    </section>
  );
}
