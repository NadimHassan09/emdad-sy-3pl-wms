import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Badge, Button, Card, Input, Skeleton } from '@ds';

import { AdminListPageShell } from '../../components/AdminListPageShell';
import { UsersApi, type CustomRoleRow } from '../../api/users';
import { useAuth } from '../../auth/AuthContext';

const MODULE_PRESETS = [
  { module: 'oms', action: 'read' },
  { module: 'oms', action: 'write' },
  { module: 'inbound', action: 'read' },
  { module: 'inbound', action: 'write' },
  { module: 'outbound', action: 'read' },
  { module: 'outbound', action: 'write' },
  { module: 'finance', action: 'read' },
  { module: 'finance', action: 'write' },
  { module: 'inventory', action: 'read' },
  { module: 'inventory', action: 'write' },
  { module: 'users', action: 'read' },
  { module: 'users', action: 'write' },
];

export function CustomRolesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isSuper = user?.role === 'super_admin';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const listQ = useQuery({
    queryKey: ['users', 'custom-roles'],
    queryFn: () => UsersApi.listCustomRoles(),
    enabled: isSuper,
  });

  const createMut = useMutation({
    mutationFn: () =>
      UsersApi.createCustomRole({
        name,
        description: description || undefined,
        permissions: MODULE_PRESETS.map((p) => ({
          ...p,
          allowed: Boolean(selected[`${p.module}:${p.action}`]),
        })),
      }),
    onSuccess: () => {
      setName('');
      setDescription('');
      setSelected({});
      setError(null);
      void qc.invalidateQueries({ queryKey: ['users', 'custom-roles'] });
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message ?? err?.message ?? 'Create failed');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => UsersApi.deleteCustomRole(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['users', 'custom-roles'] }),
    onError: (err: any) => {
      setError(err?.response?.data?.message ?? err?.message ?? 'Delete failed');
    },
  });

  const toggle = (key: string) => {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Role name is required');
      return;
    }
    createMut.mutate();
  };

  if (!isSuper) {
    return (
      <AdminListPageShell icon="Users" title="Custom Roles" subtitle="O-11" showSectionNav={false}>
        <Alert variant="warning">Only a super admin can manage custom roles.</Alert>
      </AdminListPageShell>
    );
  }

  return (
    <AdminListPageShell
      icon="Users"
      title="Custom Roles"
      subtitle="O-11 — Create editable roles with module permissions (super admin)"
      showSectionNav={false}
    >
      {error ? (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      ) : null}

      <Card padding="md" className="mb-6">
        <form className="space-y-3" onSubmit={onSubmit}>
          <h3 className="font-semibold text-text-strong">Create role</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-text-muted">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ops lead" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-text-muted">Description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {MODULE_PRESETS.map((p) => {
              const key = `${p.module}:${p.action}`;
              const on = Boolean(selected[key]);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggle(key)}
                  className={`rounded-md border px-3 py-2 text-left text-xs ${
                    on ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-border text-text-muted'
                  }`}
                >
                  <span className="font-semibold">{p.module}</span> · {p.action}
                  <div className="mt-1">
                    <Badge tone={on ? 'success' : 'neutral'} size="xs">
                      {on ? 'Allowed' : 'Denied'}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>
          <Button type="submit" variant="primary" disabled={createMut.isPending}>
            {createMut.isPending ? 'Saving…' : 'Create custom role'}
          </Button>
        </form>
      </Card>

      {listQ.isLoading ? (
        <Skeleton className="h-40" />
      ) : listQ.error ? (
        <Alert variant="error">Failed to load custom roles.</Alert>
      ) : (
        <div className="space-y-3">
          {(listQ.data ?? []).length === 0 ? (
            <Card padding="md">
              <p className="text-sm text-text-muted">No custom roles yet.</p>
            </Card>
          ) : (
            (listQ.data as CustomRoleRow[]).map((role) => (
              <Card key={role.id} padding="md" className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-text-strong">{role.name}</h4>
                    <Badge tone={role.isActive ? 'success' : 'neutral'} size="xs">
                      {role.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge tone="neutral" size="xs">
                      {role._count?.users ?? 0} users
                    </Badge>
                  </div>
                  {role.description ? (
                    <p className="mt-1 text-sm text-text-muted">{role.description}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(role.permissions ?? [])
                      .filter((p) => p.allowed)
                      .map((p) => (
                        <Badge key={`${p.module}:${p.action}`} tone="brand" size="xs">
                          {p.module}:{p.action}
                        </Badge>
                      ))}
                  </div>
                </div>
                <Button
                  variant="danger"
                  disabled={deleteMut.isPending || (role._count?.users ?? 0) > 0}
                  onClick={() => {
                    if (window.confirm(`Delete custom role "${role.name}"?`)) {
                      deleteMut.mutate(role.id);
                    }
                  }}
                >
                  Delete
                </Button>
              </Card>
            ))
          )}
        </div>
      )}
    </AdminListPageShell>
  );
}

export default CustomRolesPage;
