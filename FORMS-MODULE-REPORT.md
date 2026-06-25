# Lead Management (Forms) Module — Implementation Report

A complete lead-capture module integrated into the Emdad WMS. External HTML landing
pages submit leads to a public, rate-limited endpoint; internal admins browse, search,
filter, view, and delete submissions from a new `/forms` admin page.

---

## 1. Architecture

The module follows the existing project conventions exactly (NestJS feature module,
Prisma model + raw-SQL migration, global `JwtAuthGuard` with `@Public()` bypass, global
`ThrottlerGuard` with per-route `@Throttle()`, React page mirroring the server-paginated
list pattern, data-driven sidebar/RBAC).

```
External landing page (HTML/JS)
        │  fetch POST /api/forms/submit   (no auth, CORS-allowed, rate-limited)
        ▼
┌──────────────────────────────────────────────────────────────┐
│ NestJS backend (global prefix /api)                           │
│                                                                │
│  FormsController                                               │
│   ├─ POST   /forms/submit         @Public()  @Throttle(10/min) │
│   ├─ GET    /forms                InternalAdminGuard           │
│   ├─ GET    /forms/activity-types InternalAdminGuard           │
│   ├─ GET    /forms/:id            InternalAdminGuard           │
│   └─ DELETE /forms/:id            SuperAdminGuard              │
│                                                                │
│  FormsService → PrismaService → PostgreSQL                     │
│      (validation via DTOs + global ValidationPipe)             │
│      (Nest Logger logs every submission + deletion)            │
└──────────────────────────────────────────────────────────────┘
        ▲
        │  GET/DELETE (Bearer JWT)
┌──────────────────────────────────────────────────────────────┐
│ React admin frontend  →  /forms (FormsPage)                   │
│   FilterPanel + DataTable + useServerPagination + useFilters   │
│   Detail Modal · Delete ConfirmModal (super_admin only)        │
└──────────────────────────────────────────────────────────────┘
```

### Files added

Backend:
- `backend/src/modules/forms/forms.module.ts`
- `backend/src/modules/forms/forms.controller.ts`
- `backend/src/modules/forms/forms.service.ts`
- `backend/src/modules/forms/dto/create-lead-form.dto.ts`
- `backend/src/modules/forms/dto/list-lead-forms-query.dto.ts`
- `backend/prisma/migrations/20260901140000_lead_form_submissions/migration.sql`

Frontend:
- `frontend/src/api/forms.ts`
- `frontend/src/pages/forms/FormsPage.tsx`

### Files modified

Backend:
- `backend/prisma/schema.prisma` — added `LeadFormSubmission` model.
- `backend/src/app.module.ts` — registered `FormsModule`.
- `backend/src/main.ts` — merged `LANDING_FORM_CORS_ORIGINS` into the CORS allow-list.
- `backend/src/common/config/env.validation.ts` — added `LANDING_FORM_CORS_ORIGINS`.
- `backend/.env.example` — documented `LANDING_FORM_CORS_ORIGINS`.

Frontend:
- `frontend/src/router.tsx` — lazy route `{ path: 'forms' }`.
- `frontend/src/lib/rbac.ts` — nav item, `routeGroup`, and `ROUTE_GROUP_ROLES` (`super_admin`, `wh_manager`).
- `frontend/src/constants/query-keys.ts` — `QK.forms`.
- `frontend/src/components/Layout.tsx` — Arabic sidebar label (`النماذج`).
- `shared/design-system/lib/sidebar-nav-icons.tsx` — `Forms` icon.

---

## 2. Database schema

Prisma model (`backend/prisma/schema.prisma`):

```prisma
model LeadFormSubmission {
  id           String   @id @default(uuid()) @db.Uuid
  fullName     String   @map("full_name")
  phone        String
  email        String
  activityType String   @map("activity_type")
  message      String?
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt    DateTime @default(now()) @map("updated_at") @db.Timestamptz(6)

  @@index([createdAt(sort: Desc)], map: "idx_lead_form_submissions_created_at_desc")
  @@index([activityType], map: "idx_lead_form_submissions_activity_type")
  @@map("lead_form_submissions")
}
```

Table: `lead_form_submissions`

| Column         | Type           | Notes                          |
|----------------|----------------|--------------------------------|
| id             | UUID (PK)      | `gen_random_uuid()` default    |
| full_name      | TEXT NOT NULL  |                                |
| phone          | TEXT NOT NULL  |                                |
| email          | TEXT NOT NULL  |                                |
| activity_type  | TEXT NOT NULL  |                                |
| message        | TEXT NULL      |                                |
| created_at     | TIMESTAMPTZ(6) | default `NOW()`                |
| updated_at     | TIMESTAMPTZ(6) | default `NOW()`                |

Indexes: `created_at DESC` (list ordering), `activity_type` (filtering).

### Migration safety (no data loss)

The migration is **additive only** — it `CREATE TABLE IF NOT EXISTS lead_form_submissions`
plus two `CREATE INDEX IF NOT EXISTS`. It touches no existing table. It was applied with
`prisma migrate deploy` (which runs only pending migration files; it does not diff/drop).

Row counts captured **before and after** the migration — identical:

| Entity            | Before | After |
|-------------------|--------|-------|
| companies         | 3      | 3     |
| users             | 6      | 6     |
| products          | 4      | 4     |
| warehouses        | 1      | 1     |
| locations         | 8      | 8     |
| warehouse tasks   | 43     | 43    |
| workflow instances| 20     | 20    |
| inbound orders    | 14     | 14    |
| outbound orders   | 9      | 9     |
| lead submissions  | —      | 0 (new) |

All operational data (orders, tasks, products, inventory, etc.) is preserved.

---

## 3. API documentation

All routes are under the global prefix `/api`. Successful responses are wrapped by the
app-wide envelope `{ "success": true, "data": ... }`.

### 3.1 `POST /api/forms/submit` — Public

Receives submissions from external landing pages. **No authentication.** Rate-limited to
**10 requests / minute / IP**. CORS-restricted to origins in `CORS_ORIGINS` +
`LANDING_FORM_CORS_ORIGINS`. Body limited to 100 kb (global Express limit).

Request body:

```json
{
  "fullName": "Sara Ali",
  "phone": "+963 944 123 456",
  "email": "sara@example.com",
  "activityType": "Wholesale",
  "message": "Please contact me"   // optional
}
```

Validation (all strings trimmed before validation):

| Field        | Rules                                                        |
|--------------|-------------------------------------------------------------|
| fullName     | string, length 2–150                                        |
| phone        | string, length 5–30, matches `^[+]?[\d\s()-]{5,30}$`        |
| email        | valid email, length 3–200                                   |
| activityType | string, length 2–100                                        |
| message      | optional string, length 0–2000                             |

Unknown/extra fields are rejected (`forbidNonWhitelisted`).

Success `201`:

```json
{ "success": true, "data": { "id": "uuid", "createdAt": "ISO", "received": true } }
```

Validation error `400`:

```json
{ "success": false, "error": { "message": ["email must be a valid email address."] } }
```

Rate-limit exceeded `429`.

### 3.2 `GET /api/forms` — Admin (super_admin, wh_manager)

Server-side pagination, search, filtering, sorting.

Query params:

| Param        | Description                                   |
|--------------|-----------------------------------------------|
| search       | matches fullName / phone / email (insensitive)|
| activityType | exact activity-type filter (insensitive)      |
| createdFrom  | ISO date (inclusive lower bound)              |
| createdTo    | ISO date (inclusive — extended to end of day) |
| sort         | `asc` \| `desc` (by createdAt, default desc)  |
| limit        | 1–500 (default 50)                            |
| offset       | ≥ 0 (default 0)                               |

Response: `{ items: LeadFormSubmission[], total, limit, offset }`.

### 3.3 `GET /api/forms/activity-types` — Admin

Returns `string[]` of distinct activity types (powers the filter dropdown).

### 3.4 `GET /api/forms/:id` — Admin

Full submission detail, or `404` if not found.

### 3.5 `DELETE /api/forms/:id` — super_admin only

Permanently deletes a submission (`SuperAdminGuard`). Returns
`{ id, deleted: true }`, or `404` if not found, `403` for non-super-admin.

---

## 4. Security

- **Validation** — class-validator DTOs + global `ValidationPipe`
  (`whitelist`, `forbidNonWhitelisted`, `transform`).
- **Sanitization** — all text fields trimmed; global `sanitizeRequestPayload`
  middleware runs on every request; empty/whitespace-only fields rejected by length rules.
- **Rate limiting** — `@Throttle({ default: { limit: 10, ttl: 60_000 } })` on the public
  submit endpoint (global default 120/min applies elsewhere).
- **Oversized payloads** — global Express JSON limit (`HTTP_JSON_BODY_LIMIT`, default 100 kb)
  rejects large bodies.
- **CORS** — only trusted origins from `CORS_ORIGINS` + `LANDING_FORM_CORS_ORIGINS`.
- **Logging** — every submission and deletion is logged via Nest `Logger`
  (id, activity type, origin, IP for submissions; id + actor for deletions).
- **RBAC** — admin reads require `InternalAdminGuard`; deletion requires `SuperAdminGuard`.
  The frontend hides the route/nav for non-admins and the Delete button for non-super-admins.

---

## 5. Landing-page integration

Add the landing page's origin to `LANDING_FORM_CORS_ORIGINS` in `backend/.env`
(comma-separated), then submit from any external HTML page:

```html
<script>
async function submitLead(form) {
  const res = await fetch("https://admin.emdadsy.com/api/forms/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: form.fullName.value,
      phone: form.phone.value,
      email: form.email.value,
      activityType: form.activityType.value,
      message: form.message.value,
    }),
  });
  if (res.ok) {
    // show success
  } else {
    const { error } = await res.json();
    // show error(s): error.message
  }
}
</script>
```

`.env` example:

```
LANDING_FORM_CORS_ORIGINS=https://emdadsy.com,https://www.emdadsy.com
```

---

## 6. Frontend (`/forms`)

- Uses the standard admin `Layout`; sidebar item **Forms / النماذج** (icon `fa-file-lines`),
  visible to `super_admin` and `wh_manager` only.
- **Table columns:** Full Name, Phone, Email, Activity Type, Message (truncated), Submitted At, Actions.
- **Actions:** View Details (modal), Delete (super_admin only → confirm modal).
- **Server-side pagination** via `useServerPagination` (25/50/100 page sizes).
- **Search** by name/phone/email; **Activity Type** filter (populated from
  `/forms/activity-types`); **Date** range filter (From/To).
- **States:** loading (table skeleton/“Loading…”), empty (“No submissions match the filters.”),
  error (Alert with Retry).
- Fully bilingual (EN/AR) using `useWmsTranslation`.

---

## 7. Verification steps

Backend smoke tests (run against `http://localhost:3000`, results captured during implementation):

| # | Test                                            | Expected | Result |
|---|-------------------------------------------------|----------|--------|
| 1 | `POST /api/forms/submit` valid payload          | 201      | 201 ✓  |
| 2 | `POST /api/forms/submit` invalid email          | 400      | 400 ✓  |
| 3 | `POST /api/forms/submit` empty body `{}`         | 400      | 400 ✓  |
| 4 | `GET /api/forms` without Bearer token           | 401      | 401 ✓  |
| 5 | Trimming (`"  Sara Ali  "` → `"Sara Ali"`)       | trimmed  | ✓      |
| 6 | Row persisted in `lead_form_submissions`        | present  | ✓      |
| 7 | Data-loss check (before/after counts identical) | equal    | ✓      |

Reproduce the public submit:

```bash
curl -i -X POST http://localhost:3000/api/forms/submit \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Test Lead","phone":"+963 944 123 456","email":"lead@example.com","activityType":"Retail","message":"Hello"}'
```

Admin UI verification:
1. Log in as `super_admin` or `wh_manager`.
2. Open **Forms** in the sidebar (`/forms`).
3. Confirm submissions list with pagination; use Search / Activity Type / Date filters.
4. Click a row → detail modal shows all fields.
5. As `super_admin`, click **Delete** → confirm → row removed; as `wh_manager`, the
   Delete button is hidden.

Build verification:
- Backend: `npm run build` (backend) — passes.
- Frontend: `npx tsc --noEmit` + `npm run build` — passes.

> Note: UI screenshots are best captured from the running admin app at `/forms` after
> logging in. The backend behavior is verified via the curl/DB checks above.

---

## 8. Environment variables

| Variable                   | Required | Description                                              |
|----------------------------|----------|----------------------------------------------------------|
| `LANDING_FORM_CORS_ORIGINS`| No       | Comma-separated trusted landing-page origins for CORS.   |

Existing `CORS_ORIGINS` continues to govern the admin app origins; both lists are merged.
