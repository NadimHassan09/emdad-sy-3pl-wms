# Realtime Implementation Plan

| Field | Value |
|-------|--------|
| **Plan version** | `2.2` |
| **Last Updated** | `2026-08-04` |
| **Architecture** | [`REALTIME_ARCHITECTURE.md`](./REALTIME_ARCHITECTURE.md) **v2.2** |
| **Supersedes** | Plan 2.1 (adds dual sync-domain rules; **roadmap phases WP0–WP6 unchanged**) |
| **Status** | **Plan only — do not implement code until explicitly scheduled** |

**Rule:** Implement Architecture **2.2** only. No new feature-specific socket events or listeners. No second sync event for admin vs client.

---

## 1. Goal

Replace:

```text
Domain → emit*(feature event) → many FE listeners → patch/invalidate
```

with:

```text
Domain → publish(mutationId, companyId, …)
  → Mutation Queue (order + merge by domain/audience)
  → Module Registry (data: modules + sync domain(s))
  → Module Versions++ independently:
       Client Domain (per company) and/or Admin Domain (global)
  → Debounce (per domain + audience)
  → ONE event name system.version { version: sequence, modules }
       → company room and/or admin audience
  → ONE FE listener per app
  → Coalesce refetch
  → Active module (first route segment) + always-active session/notifications
```

**Unchanged:** single-event architecture, module-based sync, queue/merge/debounce/coalesce, strict cache lifecycle, Phase 1→2→3 migration.

**Extended:** two permanent synchronization domains (Client tenant-scoped vs Admin global). See Architecture §§4–8.

---

## 2. Migration phases (unchanged)

Do **not** jump from dual-emit to hard delete in one step.

```text
Phase 1 — Dual emit
  Legacy feature events + new system.version
       ↓
Phase 2 — Verify
  Canonical FE path proven on staging (Matrix / DoD checks)
  Legacy listeners can be no-op behind flag
       ↓
Phase 3 — Delete legacy
  Remove feature emitters, events, listeners, cache patches
```

| Phase | Backend | Frontend | Exit criteria |
|-------|---------|----------|---------------|
| **1 Dual emit** | Queue + dual-domain module versions + `system.version` **and** legacy emits | Listen to both; prefer canonical for pilot modules | Events observed; tenant isolation spot-checked |
| **2 Verify** | Prefer `REALTIME_SYNC_MODE=dual` still | `canonical` for cut-over modules; soak; fix bugs | Architecture DoD checklist green on staging |
| **3 Delete legacy** | `canonical` only; delete emit* / old events | Delete multi-handlers / `*-cache` patches | DoD fully true; code search clean |

If Phase 2 finds a bug, **stay in dual** — do not enter Phase 3 until fixed.

---

## 3. Definition of Done (architecture complete only if)

Cutover is **not** done unless **all** are true (Architecture §20):

- exactly one websocket synchronization event exists  
- exactly one frontend synchronization listener exists **per application**  
- zero feature-specific listeners remain  
- zero feature-specific sync emitters remain  
- every shared-state mutation goes through Mutation Queue  
- every mutation resolves through Module Registry (data) including **sync domain(s)**  
- Module Versions are freshness truth **per domain** (Client tenant-scoped; Admin global); wire `version` is queue sequence only  
- **Client Domain never notifies another company**  
- **Admin Domain receives operational bumps from all tenants**  
- **Client and Admin version stores / audiences are never mixed**  
- queue merge rule implemented (respecting domain + audience)  
- emit debounce implemented  
- FE request coalescing implemented  
- only the active module (first-route-segment map) refetches for route modules  
- inactive route modules never refetch  
- leave disposes module cache; enter fresh-fetches  
- session always synchronized  
- notifications always synchronized  
- no manual browser refresh required for active-module correctness  

---

## 4. Work packages (roadmap unchanged; domain rules apply inside each WP)

### WP0 — Policy freeze

Stop 1.0 expansion; point to Architecture 2.2; mark audit/verification as historical.

### WP1 — Backend foundation

| Deliverable | Rule |
|-------------|------|
| Module Registry | **Data**: mutation → client modules[] + admin modules[] (domains) |
| Mutation Queue | Ordered + **merge** keyed by **domain + audience** (companyId for client; global for admin) |
| Module Versions | **Two stores**: `company:{id}:*` and `admin:*` |
| Queue sequence | Wire `version` field only (per emit / domain as implemented) |
| Debounce | ~100ms per domain + audience |
| Emit | Same event `system.version` to correct room(s) only |
| `publish(mutationId, companyId, …)` | Domain API |
| Isolation tests | Company A mutate → Company B client receives nothing; Admin receives |
| Flags | `legacy \| dual \| canonical` |

### WP2 — Frontend foundation

| Deliverable | Rule |
|-------------|------|
| Two apps independently | Admin listener ↔ Admin Domain; Client listener ↔ Client Domain |
| Active module | First route segment → module via **data** route map **per app** |
| Always-active | `session`, `notifications` (domain-isolated) |
| Cache lifecycle | Leave **MUST dispose**; enter **MUST fresh fetch** |
| Request coalescing | Per module within that app |
| Dual listen | Phase 1 |

### WP3 — Pilot (Phase 1→2)

Modules: `inbound`, `outbound`, `inventory`, `tasks`, `dashboard` (+ always-active).  
Verify **tenant isolation** and **admin global visibility** as part of pilot.

### WP4 — Remaining modules

Same as 2.1 list; registry rows always declare client and/or admin module sets.

### WP5 — Phase 3 delete legacy

Remove feature events, emit methods, multi-handlers, patch helpers.

### WP6 — Sign-off

Full DoD including dual-domain isolation; production after staging soak.

---

## 5. Backend detail checklist (domains)

1. Registry returns **per-domain** module lists (data).  
2. Merge never crosses companies in Client Domain; Admin merges globally.  
3. Increment Client vs Admin counters independently.  
4. Emit only to matching audience(s); never broadcast client updates to all tenants.  
5. Domain services never invent module or domain lists inline.

---

## 6. Frontend detail checklist (two apps)

1. Admin and Client are separate apps — separate listeners, caches, route maps.  
2. Client never subscribes to another company’s sync.  
3. Admin treats global module bumps as expected.  
4. Same coalesce / dispose / always-active rules as Architecture 2.1/2.2.

---

## 7. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Tenant leak | Mandatory room + per-company version store; isolation tests in WP1/WP3 |
| Admin overload from all tenants | Active-module gate + coalesce + merge/debounce (accepted product intent) |
| Mixing version stores | Separate Redis key namespaces `company:` vs `admin:` |
| Second event temptation | Forbidden — same `system.version`, different rooms |
| Phase 3 too early | Hard gate: Phase 2 verify including isolation |

---

## 8. Testing strategy

- Unit: registry domain resolution; separate version incr; merge keys by audience  
- Integration: ACME mutate → ACME client + all admins; BETA client silent  
- FE: two apps independently; no cross-app assumptions  
- E2E Phase 2: DoD + isolation before Phase 3  

---

## 9. Rollout (unchanged order)

1. Staging WP1–WP2 Phase 1  
2. Staging WP3–WP4 Phase 2 verify (include dual-domain checks)  
3. Staging WP5 Phase 3  
4. Production: Phase 1 → soak → Phase 2 → Phase 3  

---

## 10. Mapping old P0–P4 gaps

Unchanged: gaps become `publish` + registry rows (now with domain columns). Gap IDs = test cases.

---

## 11. Out of scope until execution approval

Writing production code; changing Product Matrix scope; replacing Socket.IO; adding a second sync event type.
