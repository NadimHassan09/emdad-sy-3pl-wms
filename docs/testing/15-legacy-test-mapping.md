# 15 — Legacy tests → new test IDs ("start from zero" mapping)

Rule: legacy tests are **inputs**, not results. Each is re-written/re-run against the current system; none counts as passed until re-executed in phase 3.

## 1. Existing automated assets

| Asset | Count / location | Reuse | Maps to |
|---|---|---|---|
| Backend Jest unit specs | 165 files under `backend/src/**/*.spec.ts` (990 tests; modules with most specs: shipping 51, oms 34, client-portal 17, reports 7, outbound 6, oms-returns 5) | Keep as regression; re-run; add the 208 gap files in `generated/UNIT_GAP_BACKEND.md` | `01` |
| Frontend Vitest specs | 32 in `frontend/src/**/*.unit.spec.ts` (lib/hooks/data only) | Keep; add 122 gaps | `01`, `02` |
| Client frontend unit specs | **0** | create | `01`, `02` |
| `frontend/e2e/*.spec.ts` (Playwright, mocked APIs) | backup-6d-*, backup-admin-5c, backup-create-ui, backup-google-drive, backup-operations, billing-pagination-ui, notifications-center-ui, oms-shipping-fee-bulk, rbac-nav-consistency, warehouses-ui, example | Rewrite against real staging data where mocks hide bugs (mocked API tests cannot prove integration); keep mocks only for component-level | `04a` PA068–073, PA060, PA066, PA012, PA004, `09` RBAC |
| `tests/e2e/admin/*.spec.ts` | billing-4b, realtime-* (10), release-r2-realtime, release-r3-workflow | Re-run; realtime ones → `03` IT-PLT-003 + LB-22 | |
| `tests/e2e/client/*.spec.ts` | client-portal-2, screens-coverage | → `04b` | |
| `tests/api/login-brute-force.spec.ts` | 1 | keep → UT-AUT-004/SEC-AUT-004 | |
| `tests/helpers/*` (auth, endpoint-catalog, workflow-fixture, release-r3-*) | helpers | reuse after removing the committed password (SEC-OBS-01); `endpoint-catalog.ts` can seed the endpoint battery | `03` |
| `qa-scripts/*.mjs` + `routes.json` + `carriers.config.json` | smoke (admin/client, desktop/mobile), carrier portal search with guard | keep as owner-machine tools; guard logic reused | `04`, `18` |
| `docs/handover/qa_progress.py` + `QA_COVERAGE.md` | coverage calculator | replace by `14-coverage-matrix.md` generator | `14` |

## 2. Legacy flows F01–F42 and cross-cutting X01–X16 → new IDs

| Legacy | Topic | New ID(s) |
|---|---|---|
| F01 | Create OMS order (admin) | E2E-OMS-001, PA013, FB |
| F02 | Create order (client) | E2E-CLI-005, PC (ecommerce-orders/new) |
| F03 | Import orders | E2E-OMS-010, IT-ORD-008, UT-IMP-* |
| F04 | Confirm/approve, fee coverage | E2E-OMS-004, UT-FEE-003 |
| F05 | Outbound admin execution | E2E-ORD-010 |
| F06 | Outbound/inbound by workers | E2E-ORD-002/011, IT-ORD-011 |
| F07 | Bulk shipping modal | E2E-CAR-009, UT-CAR-003 |
| F08 | Batches, waybills | E2E-OMS-011/013 |
| F09 | Edit order/shipping fee | E2E-OMS-006/007 |
| F10 | Cancel order | E2E-OMS-008 |
| F11 | Change carrier | E2E-OMS-009 |
| F12 | Delivered via webhook | E2E-CAR-001/007 |
| F13/F14 | Failed delivery, returns | E2E-OMS-015, E2E-RET-* |
| F15/F16 | COD generation/collection/remittance | E2E-FIN-001, SYS-FIN-001..003 |
| F17–F20 | Carriers Sena/Babel/Sila/Joud | E2E-CAR-001..005 |
| F21 | Webhooks | E2E-CAR-007, SEC-WH-001 |
| F22 | Coverage/eligibility | E2E-CAR-006, UT-CAR-001 |
| F23 | Currencies | SYS-CUR-*, UT-MON-* |
| F24 | Inbound | E2E-ORD-001..006 |
| F25/F26 | Inventory, adjustments, cycle count | E2E-INV-* |
| F27–F30 | Master data | E2E-MD-* |
| F31/F32 | Finance, billing | E2E-FIN-*, E2E-BIL-* |
| F33 | Reports | RB battery, PA026–PA044 |
| F34/F35 | Users/roles, audit/notifications | E2E-USR-*, E2E-ADM-001/002 |
| F36 | Backups | E2E-ADM-003, IT-PLT-004 |
| F37 | Forms and contracts | E2E-ADM-004/005 |
| F38 | Auth | AUTH-01…20, SEC-AUT-* |
| F39–F41 | Client portal | E2E-CLI-* |
| F42 | External API | E2E-EXT-*, IT-EXT-001 |
| X01 | RBAC matrix | SEC-RBAC-* |
| X02 | Tenant isolation | SEC-TEN-*, IT-TEN-* |
| X03 | Input handling | SEC-INP-* |
| X04 | Secrets/config (owner decision pending) | SEC-CFG-006, SEC-OBS-01/02/09 |
| X05 | Validation sweep | FB battery on every form |
| X06–X08 | Functional/semantic/visual errors | SYS-X-*, VIS-L-*, UX-EL-* |
| X09 | Responsive | VIS-L-15, device matrix |
| X10 | Performance/N+1 | PERF-UI-002, PERF-API-* |
| X11 | Accessibility | A11Y-* |
| X12 | Data integrity | IT-INV-001…010, SYS-INV-* |
| X13/X14 | Unit + Playwright regression | `01`, `06` |
| X15 | Handover pack | UAT-20 |
| X16 | Redirect aliases | RD-01/02 on 31 redirect routes |

## 3. Legacy defects D-001…D-048 → regression rows RG-001…RG-036 in `06`.
