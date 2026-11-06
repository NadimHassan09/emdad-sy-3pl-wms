# EMDAD WMS — QA Documentation Package

**Purpose:** Expected-behavior reference for browser-based QA agents (for example Kane CLI) and human testers — including **UI, workflow, validation, permissions, business rules, calculations, and cross-module consistency**.

**Audience:** External AI agents and QA engineers who interact with the product **only through the UI**. Do not treat this package as developer documentation.

**Environment this package describes:** Staging behavior reverse-engineered from the application. Staging URLs:

| Portal | URL |
|--------|-----|
| Admin | https://staging-admin.emdadsy.com |
| Client | https://staging-client.emdadsy.com |

Production domains exist separately (`admin.emdadsy.com`, client production). Prefer staging for automated QA unless instructed otherwise.

**Confidence policy:** Where implementation was incomplete, feature-flagged, or UI/backend parity was unclear, documents mark **UNKNOWN / NEEDS VERIFICATION** and a confidence level. See also `22-DOCUMENTATION-CONFLICTS.md`.

---

## What to read first

1. `00-SYSTEM-OVERVIEW.md` — product purpose, portals, roles, lifecycle
2. `01-AUTHENTICATION-AND-ROLES.md` — login and permission matrix
3. `15-KANE-QA-GUIDE.md` — how a browser QA agent should use this package (**includes Business Logic Testing**)
4. `18-BUSINESS-RULES-AND-INVARIANTS.md` — what MUST be true
5. `14-QA-SCENARIO-MATRIX.md` — executable scenario catalog (incl. BR/CALC/INV/DUP/CONS)

---

## File index

| File | Contents |
|------|----------|
| `00-SYSTEM-OVERVIEW.md` | Product overview, portals, main lifecycle |
| `01-AUTHENTICATION-AND-ROLES.md` | Login, sessions, roles, permissions |
| `02-ADMIN-PORTAL.md` | Admin navigation, modules, pages |
| `03-CLIENT-PORTAL.md` | Client portal experience |
| `04-INBOUND-WORKFLOW.md` | Inbound receiving lifecycle |
| `05-OUTBOUND-WORKFLOW.md` | Outbound fulfillment & shipping stages |
| `06-OMS-WORKFLOW.md` | Ecommerce / OMS commercial orders |
| `07-INVENTORY.md` | Stock, locations, adjustments, products |
| `08-TASKS.md` | Warehouse tasks & cycle count |
| `09-BILLING.md` | Plans, invoices, account status |
| `10-DOCUMENTS.md` | GRN, DN, contracts, invoice PDFs |
| `11-NOTIFICATIONS-AND-REALTIME.md` | Inbox, live updates |
| `12-UI-BEHAVIOR.md` | Shared UI patterns, empty/loading states |
| `13-ERRORS-AND-VALIDATION.md` | Visible validation and errors |
| `14-QA-SCENARIO-MATRIX.md` | Scenario matrix for agents |
| `15-KANE-QA-GUIDE.md` | Agent operating rules + business-logic testing |
| `16-RETURNS.md` | OMS returns & warehouse returns |
| `17-SHIPPING-AND-CARRIERS.md` | Shipping method & carrier UX |
| `18-BUSINESS-RULES-AND-INVARIANTS.md` | **Business rules, invariants, forbidden states** |
| `19-CALCULATIONS-AND-DERIVED-VALUES.md` | **Formulas, rounding, double-calc risks** |
| `20-CROSS-MODULE-INVARIANTS.md` | **OMS↔Outbound↔Inventory↔Billing sync** |
| `21-END-TO-END-INVARIANTS.md` | **Journey-level must-remain-true conditions** |
| `22-DOCUMENTATION-CONFLICTS.md` | **Known tensions / verification needed** |

---

## By QA focus

### Admin QA

Read: `01`, `02`, `04`–`11`, `16`–`18`, `20`, then scenarios in `14`.

### Client QA

Read: `01`, `03`, `06`, `09`, `11`, `18` (billing/OMS rules), then Client scenarios in `14`.

### Business-logic / calculation QA

Read: `15` (Business Logic Testing), `18`, `19`, `20`, `21`, `22`, then BR-/CALC-/INV-/DUP-/CONS- rows in `14`.

### End-to-end workflows

Read: `00`, `04`–`06`, `16`, `17`, `21`, plus E2E / CONS scenarios in `14`.

---

## Known uncertainty areas

Treat these as Medium/Low confidence unless re-verified on staging:

1. Feature flags: OMS COD/Returns UI, Google Drive backups, Google Sign-In, `TASK_ONLY_FLOWS`, `ALLOCATE_ON_ORDER_CREATE`.
2. Whether finance / warehouse operator see OMS screens in UI (backend JWT may allow more than the sidebar shows).
3. Outbound `delivered` status vs commercial OMS Mark delivered (see CONFLICT-001).
4. Client invoice PDF download (client UI uses browser Print; admin has Download PDF).
5. Cycle count session creation entry points from list chrome.
6. Outbound returns discoverability in client portal (no sidebar link).
7. Email delivery of notifications (in-app is confirmed; email channel exists but may not send for all event types).
8. Over-receive 100% vs 110% path variance (CONFLICT-004).
9. Billing UI vs backend OMS/returns gate gap (CONFLICT-003).
10. Whether `shipping_details` worker task always spawns after method selection (CONFLICT-008).

---

## Rules for maintainers

- Update this package when user-visible **or** business-rule behavior changes.
- Do not invent features or formulas.
- Prefer UI labels and statuses over technical identifiers; keep Source references in `18`–`21` for traceability.
- Documentation-only: never change application code as part of maintaining this folder unless separately requested.
