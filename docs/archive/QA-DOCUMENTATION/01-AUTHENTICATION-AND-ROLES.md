# 01 — Authentication and Roles

**Confidence:** High for login fields, redirects, and nav-based permissions. Medium for Google Sign-In (feature-dependent) and soft logout / remember-me edge cases.

---

## Portals and login separation

| Portal | Login URL (staging) | Who may sign in |
|--------|---------------------|-----------------|
| Admin | https://staging-admin.emdadsy.com/login | Internal roles only |
| Client | https://staging-client.emdadsy.com/login | `client_admin`, `client_staff` |

Using the wrong portal with the other account type should fail authentication (user sees invalid credentials / cannot enter). Treat cross-portal login as a **negative** test.

---

## Admin login experience

### Visible elements

- Title: **Welcome back**
- Subtitle about signing in to manage warehouse operations
- **Email**
- **Password**
- **Remember me for 30 days**
- **Sign in** (busy state: **Signing in…**)
- Language: English / العربية
- Optional **Sign in with Google** when enabled by environment
- If a remembered account exists: chip with **Continue**, **Not you?**, **Remove remembered account**

### Successful login

1. User enters valid email/password (or completes Google / Continue).
2. System loads the authenticated shell.
3. Redirect:
   - If a safe return URL was stored (user hit a protected page while logged out) → that path, if role allows it
   - Else **warehouse operator** → `/tasks`
   - Else → `/dashboard/overview`

### Failed login

- Invalid credentials: user remains on login; error feedback is shown (exact copy may vary by language).
- **Confidence:** High that submission fails; Medium for exact error string.

### Already logged in

Visiting `/login` while authenticated redirects away from login to the role home.

### Inactive / forced session end

- Expired or forced session → user is sent to `/login`.
- Remembered Continue may show: *Your saved session expired. Enter your password to continue.*

### Logout

User menu → **Sign out**. Session clears; user lands on `/login`. Soft logout behavior may preserve “Continue” when remember-me was used.

### Loading states

- App boot: **Loading…**
- Google completing: **Signing in with Google…**

---

## Client login experience

### Visible elements

Similar pattern: **Welcome back**, Email, Password, Remember me, Sign in, language toggle, remembered account Continue/Remove.

Brand chrome: **EMDAD** / Client Portal (Arabic: بوابة العميل).

### Successful login

Redirect to `state.from` if present, otherwise **`/dashboard`**.

### Inactive account

If the account is inactive, user is directed to **`/account-inactive`** with message **Your account is inactive** (and support contact may be shown).

### Logout

Topbar **Sign out** → `/login`.

### Unauthorized API session

401 responses clear the session token and send the user to `/login`.

---

## Protected pages

| Behavior | Admin | Client |
|----------|-------|--------|
| Unauthenticated deep link | Redirect to `/login` with return path | Same |
| Authenticated but role cannot access path | Redirect to role home | Redirect to dashboard; may show **Page not available for your role** |
| Unknown authenticated path | Role home redirect | **Page not found** inside shell |

---

## Role permission matrix (user-visible)

### Admin portal — module access (sidebar / route)

| Module | Super admin | Manager | Operator | Finance |
|--------|:-----------:|:-------:|:--------:|:-------:|
| Dashboard | ✓ | ✓ | — | ✓ |
| Inbound / Outbound | ✓ | ✓ | — | ✓ |
| Inventory | ✓ | ✓ | — | ✓ |
| Tasks | ✓ | ✓ | ✓ | ✓ |
| Cycle count | ✓ | ✓ | ✓ | ✓ |
| Returns | ✓ | ✓ | ✓ | ✓ |
| Products / Locations / Warehouses | ✓ | ✓ | — | — |
| OMS Dashboard / Orders | ✓ | ✓ | —* | ✓ |
| COD / OMS Returns | ✓† | ✓† | —* | ✓† |
| Contracts | ✓ | ✓ | ✓ | ✓ |
| Reports | ✓ | ✓ | — | ✓ |
| Clients / Forms / Users | ✓ | ✓ | — | — |
| Billing | ✓ | ✓ | — | ✓ |
| Audit logs | ✓ | ✓ | — | ✓ |
| Notifications / Profile | ✓ | ✓ | ✓ | ✓ |
| Backups | ✓ | ✓ | — | — |
| Shipping Companies | ✓ | ✓ | — | — |
| Internal transfer | ✓ | ✓ | — | — |

\* Backend may allow broader JWT access than the sidebar; **UNKNOWN / NEEDS VERIFICATION** whether operators can open OMS URLs directly.  
† Hidden entirely if OMS COD/Returns UI feature flag is off.

### Special admin UI gates

| Capability | Who |
|------------|-----|
| Cycle count **My tasks** / execute | User must have linked worker profile |
| Record final OMS shipping fee | Super admin, manager, finance |
| Internal transfer | Super admin, manager |
| Google Drive backup tab | Feature flag |
| Destructive backup / factory reset | Super admin (backend) |

### Client portal — module access

| Module | client_admin | client_staff |
|--------|:------------:|:------------:|
| Dashboard | ✓ | ✓ |
| Online orders / COD / Ecommerce returns | ✓ | ✓ |
| Inbound / Outbound / Inventory (products) | ✓ | ✓ |
| Notifications / Profile | ✓ | ✓ |
| Billing / Invoices / APIs | ✓ | — |
| Create / edit / delete products | ✓ | — (view only) |
| Create inbound / outbound / OMS / returns | ✓ | ✓ |
| Outbound returns pages | ✓ (URL; not in sidebar) | ✓ |

### Client account operational gates (billing)

When company billing status is **restricted** or **no_plan**:

- Create and import actions are disabled portal-wide.
- Banner: **Account restricted** / **No billing plan**.

**Expiring** status shows a warning but does not block creates.

---

## What the user sees when denied

| Portal | Typical UX |
|--------|------------|
| Admin | Sidebar item hidden; deep link → redirected to home |
| Client | Deep link → dashboard + banner **Page not available for your role** |
| Client product create as staff | Navigate away from `/products/new` to product list |
| Client billing as staff | Same deny pattern |

Whether the backend also rejects the API call: **Yes for sensitive client billing/product/API mutations**. UI should already hide those actions. **Confidence:** High.

---

## Role home paths

| Role | Home after login (default) |
|------|----------------------------|
| wh_operator | `/tasks` |
| Other internal roles | `/dashboard/overview` |
| client_admin / client_staff | `/dashboard` |
