# Phase 1.3 — WebSocket Tenant Isolation

**Status:** Implemented (backend realtime layer)  
**Date:** 2026-05-26  
**Builds on:** [PHASE-1.1-COMPANY-ACCESS.md](./PHASE-1.1-COMPANY-ACCESS.md), [PHASE-1.2-HTTP-TENANT-ENFORCEMENT.md](./PHASE-1.2-HTTP-TENANT-ENFORCEMENT.md)  
**Scope:** Socket.IO authentication, tenant room authorization, and event isolation.

---

## Summary

Realtime sockets now resolve tenant access server-side before room join. Internal users can no longer join arbitrary company rooms by passing a raw UUID in `handshake.auth.companyId`. Client sockets are pinned to their token company. Broadcasts use canonical validated room names.

---

## Secured gateways

### `backend/src/modules/realtime/realtime.gateway.ts`

- Kept JWT-authenticated socket sessions (`auth.token` required; invalid JWT disconnects).
- Added `CompanyAccessService`-backed tenant resolution for internal sockets:
  - `resolvePrincipalTenant(userId, role, handshakeCompanyId)` validates membership and active company.
  - Unauthorized / invalid tenant selection disconnects socket.
  - Internal sockets without resolvable active tenant are rejected.
- Client sockets:
  - Still authenticated by client JWT.
  - Optional `auth.companyId` must match token company; mismatch disconnects.
- Room joins now use canonical room key helper (`companyRoomName`), not free-form string interpolation.

### `backend/src/modules/realtime/realtime-socket-auth.ts`

- Added room/tenant helpers:
  - `normalizeCompanyId(...)`
  - `companyRoomName(companyId)` -> `tenant:company:{uuid}`
- `isValidCompanyRoomId` now delegates to canonical normalization.
- JWT authentication logic kept unchanged for user identity and role validation.

### `backend/src/modules/realtime/realtime.service.ts`

- Event emission now normalizes and validates `companyId` before broadcast.
- Invalid company IDs are dropped with warning (prevents accidental unsafe room targets).
- Broadcast target changed to canonical room naming via `companyRoomName(...)`.
- Event payload contracts remain unchanged except normalized lowercase `companyId`.

---

## Authorization changes

1. **No frontend-trusted room IDs for internal users**  
   `handshake.auth.companyId` is now only a hint passed into `CompanyAccessService` membership validation.

2. **Tenant-aware room authorization at connect time**  
   Socket connection is accepted only when server can resolve an authorized tenant room.

3. **Canonical secure room naming**  
   Room keys are centralized and not manually concatenated in multiple places.

4. **Broadcast hardening**  
   Realtime emit path validates company room ids before sending events.

---

## Removed unsafe room subscription patterns

- Internal socket flow no longer does:
  - "UUID format valid -> allow join"
- Internal socket flow now does:
  - "JWT valid -> user active/internal -> `resolvePrincipalTenant` -> join authorized room only"

---

## Remaining websocket risks / follow-ups

1. **Single-tenant-per-socket model for internal users**  
   Internal users with global scope still select one active tenant per socket via `auth.companyId`. This is secure but requires reconnect to switch tenant.

2. **No explicit runtime join/leave events**  
   Current gateway relies on connect-time join only (no custom `join_room` handler exists). This is safe now, but if join handlers are introduced later they must reuse `CompanyAccessService`.

3. **Token revocation granularity**  
   Active-user check is performed on connect. Mid-session role/membership changes do not force immediate disconnect unless the socket reconnects.

4. **CORS/socket origin policy**  
   Gateway currently allows dynamic CORS origin (`origin: true`). Authentication prevents unauthorized access, but stricter origin allow-listing can reduce exposure.

---

## Verification

```powershell
cd backend
npx tsc --noEmit
```

No TypeScript or lint issues introduced by this phase.
