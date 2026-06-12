# Worker profile management workflow

Warehouse operators (`wh_operator`) must have a linked **worker profile** (`workers.user_id`) to execute blind cycle counts, appear in task assignment lists, and receive warehouse tasks.

## Roles

| Actor | Responsibility |
|-------|----------------|
| Super admin / warehouse manager | Create operators, provision or link worker profiles, assign operational roles |
| Warehouse operator | Sign in after profile is linked; execute cycle counts and tasks |

## Provisioning paths

### 1. Create operator (recommended)

1. Select an **active client tenant** in the admin shell.
2. Open **Users → Warehouse users → + New user**.
3. Choose system role **Worker** and complete the form.
4. On save, the API auto-creates a worker profile in the active tenant with default roles: receiver, picker, packer.

### 2. Provision on existing operator

1. Open **Users → Warehouse users** and edit (or open detail) for a `Worker` role user.
2. In the **Worker profile** panel, choose operational roles and optional home warehouse.
3. Click **Provision profile** (or **Update profile** if one already exists).

### 3. Link an orphan worker row

If a worker was created from the workflow API without a user:

1. In the worker profile panel, choose **Link existing profile**.
2. Pick an unlinked worker from the tenant (`GET /api/workers/unlinked`).
3. Save — the operator user is linked via `workers.user_id`.

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/users/:id/worker-profile` | Read linked profile (operators only) |
| `PUT` | `/api/users/:id/worker-profile` | Create, update, or link profile |
| `GET` | `/api/workers/unlinked` | List tenant workers with `user_id` null |

`PUT` body:

```json
{
  "warehouseId": "uuid-or-null",
  "roles": ["receiver", "picker"],
  "linkWorkerId": "optional-orphan-worker-uuid"
}
```

User list/detail responses include `workerProfile` summary for list badges and detail cards.

## Cycle count onboarding

Operators without `workerId` on `/auth/me` see a guided banner on:

- **Cycle count → My tasks**
- **Cycle count → Execute**

The banner lists admin steps and links managers to **Users → Warehouse users**. After provisioning, the operator must **sign out and sign in** so `/auth/me` returns `workerId`.

## Validation and errors

| Scenario | Message / behavior |
|----------|-------------------|
| Non-operator user | Worker profile APIs return 400 — change role to Worker first |
| Client portal user | Worker profiles not applicable |
| No active tenant | 400 when provisioning — select client tenant |
| Unknown warehouse | 404 with warehouse hint |
| Provision without roles | 400 — at least one operational role required |
| Link worker already assigned | 409 conflict |
| Inactive worker profile | Cycle count APIs return 403 with reactivation guidance |

## Operational roles

`receiver`, `picker`, `packer`, `qa`, `dispatcher` — stored in `worker_role_assignments`.
