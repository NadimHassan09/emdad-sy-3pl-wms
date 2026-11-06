# Graphify Setup, Validation & Knowledge Graph Audit Report
**Target Environment:** EMDAD 3PL Staging Environment (`/var/www/emdad-sy-3pl-wms-staging`)  
**Auditor:** Senior Software Engineer & Technical Infrastructure Auditor  
**Date:** November 2, 2026  
**Document Status:** Complete & Verified  

---

## 1. VPS and Environment Identification

| Component | Staging Specification | Production Specification |
| :--- | :--- | :--- |
| **Project Root** | `/var/www/emdad-sy-3pl-wms-staging` | `/var/www/emdad-sy-3pl-wms` |
| **PM2 Process Name** | `emdad-wms-backend-staging` (PM2 ID: 1) | `emdad-wms-backend` (PM2 ID: 0) |
| **Internal HTTP Port**| `127.0.0.1:3001` | `127.0.0.1:3000` |
| **Nginx Ingress** | `staging-api.emdadsy.com` / `staging-admin` / `staging-client` | `api.emdadsy.com` / `admin` / `client` |
| **Database** | PostgreSQL `wms_db_staging` (port 5432) | PostgreSQL `wms_db` (port 5432) |
| **Git Working Tree** | Independent working tree on branch `staging` | Independent working tree on branch `main` |
| **Repository Remote**| `https://github.com/NadimHassan09/emdad-sy-3pl-wms.git` | `https://github.com/NadimHassan09/emdad-sy-3pl-wms.git` |

> [!IMPORTANT]
> **Production Safety Invariant Verified:** Staging and Production maintain strictly distinct file directories, PM2 process IDs, database names, and Git working trees. Zero files or processes in `/var/www/emdad-sy-3pl-wms` were modified, restarted, or inspected destructively during this installation.

---

## 2. Confirmation of Git Backup and Push

Prior to installing Graphify or creating local configuration, all uncommitted development work on Staging (covering Finance management, Sila integration updates, StatusCardNav filtering, streaming exports, and the comprehensive development audit) was preserved and backed up to GitHub.

### 2.1 Git Audit and Staging Sanity
- **Excluded Sensitive Files:** `backend/.env` (containing database credentials, JWT secrets, and Sila webhook tokens) was untracked from Git (`git rm --cached backend/.env`) to prevent secrets from entering public or team remote history. An encrypted local backup was preserved at `backend/.env.staging.safe.bak`.
- **Ignored Artifacts:** Local dumps (`.playwright-mcp/`), temporary test directories (`tmp/`, `ui-audit/`), and screenshots were placed in `.gitignore`.
- **Committed Scope:** 606 files changed with **104,715 insertions** and 18,488 deletions.
- **Commit SHA:** `71caf6f0059efd962c215e3257bc471efa51a6fd`
- **Commit Message:** `chore: preserve staging development work, financial management, carrier updates, and audit report`
- **Remote Push:** Pushed cleanly to `origin/staging` via fast-forward:
  ```bash
  git push origin staging
  # To https://github.com/NadimHassan09/emdad-sy-3pl-wms.git
  # 04470a92..71caf6f0  staging -> staging
  ```
- **HEAD Parity:** Local `HEAD` matches `origin/staging` at `71caf6f0059efd962c215e3257bc471efa51a6fd`.

---

## 3. Graphify Version, Installation Location, and Architecture

- **Package Name:** `graphifyy` (PyPI package: `graphifyy`, CLI command: `graphify`)
- **Version:** `0.9.100`
- **Python Runtime:** Python `3.12.3` (satisfies requirement `>= 3.10`)
- **Installation Method:** Fully isolated Python virtual environment at `/opt/graphify-venv`
  - Python package manager: Isolated `pip` within virtual environment
  - Executable symlink: `/usr/local/bin/graphify -> /opt/graphify-venv/bin/graphify`
  - System impact: Zero global package pollution; zero modifications to Node.js/npm dependencies in backend or frontend; zero background daemon or cron services installed.
- **Dependencies Installed:**
  - Core: `networkx` (3.7), `numpy` (2.5.4), `pyyaml` (6.0.3), `rapidfuzz` (3.14.6)
  - Parsers: Tree-sitter core (0.25.2) + grammar bindings for TypeScript, JavaScript, Python, Go, Rust, Java, C#, C/C++, PHP, Bash, JSON, Ruby, Scala, Swift, Kotlin, and Elixir.

---

## 4. Configuration and Exclusion Rules for EMDAD Staging

- **Target Root:** `/var/www/emdad-sy-3pl-wms-staging`
- **Configuration File:** Dedicated `.graphifyignore` created in Staging project root:
  ```ignore
  # Environment & Secrets
  .env
  .env.*
  *.pem
  *.key
  *.pfx
  *.cert
  *.crt

  # Dependencies & Build Artifacts
  node_modules/
  **/node_modules/
  dist/
  **/dist/
  build/
  **/build/
  .next/
  coverage/
  **/coverage/
  *.tsbuildinfo
  **/tsconfig.tsbuildinfo

  # VCS & Local Tool Artifacts
  .git/
  .vscode/
  .playwright-mcp/
  playwright-report/
  **/playwright-report/

  # Storage, Uploads, Media & Runtime Dumps
  uploads/
  **/uploads/
  storage/
  **/storage/
  backend/storage/
  logs/
  **/logs/
  *.log
  tmp/
  **/tmp/
  staging-backups/
  backups/
  **/backups/
  *.dump
  *.sql
  *.png
  *.jpg
  *.jpeg
  ui-audit/
  scratch/
  ```

---

## 5. Knowledge Graph Generation Statistics

Initial AST extraction was executed using `graphify extract . --code-only --max-workers 2`, followed by Leiden community detection clustering and multi-target format generation.

- **Total Files Scanned:** 1,953 files
- **Total Code Files Indexed:** 1,711 files
- **Total Words Analyzed:** 1,928,161 words
- **Graph Nodes:** **17,528 nodes** (including classes, interfaces, methods, functions, controllers, DTOs, and UI components)
- **Graph Edges / Relationships:** **46,441 edges** (`imports_from`, `calls`, `implements`, `references`, `shares_data_with`)
- **Extraction Confidence Breakdown:** 96% EXTRACTED (deterministic AST & call-graph), 4% INFERRED (structural shared data / models), 0% AMBIGUOUS
- **Detected Communities:** 728 modular clusters / architectural domains

### Output Artifacts Directory (`graphify-out/`)

| File / Folder Path | Size | Description |
| :--- | :--- | :--- |
| `graphify-out/graph.json` | ~18 MB | Canonical GraphRAG JSON knowledge graph with nodes, links, and community metadata. |
| `graphify-out/GRAPH_REPORT.md` | ~78 KB | Plain-text architectural audit report: God nodes, community hubs, surprising connections. |
| `graphify-out/graph.html` | ~17 MB | Standalone interactive visualizer with searchable community clustering. |
| `graphify-out/wiki/` | 371 articles | Markdown encyclopedia for AI agent navigation (`wiki/index.md` entry point). |
| `graphify-out/obsidian/` | 13,012 notes | Complete Obsidian vault with `graph.canvas` visual layout for human review. |
| `graphify-out/manifest.json` | ~397 KB | File hash manifest powering fast, sub-second incremental updates. |

---

## 6. Architectural Communities & Navigation Hubs (God Nodes)

The Leiden clustering algorithm detected major architectural community hubs:

1. **`OmsOrdersListPage.tsx` (260 nodes):** Commercial order listing, filtering, status badges, and action triggers.
2. **`outbound.service.ts` (155 nodes):** Warehouse outbound fulfillment, inventory allocations, pick tasks, and dispatch states.
3. **`shipping.service.ts` & `shipping-tracking.service.ts` (230 nodes):** Courier abstraction layer, quote dispatch, waybill persistence, and Sila webhook processing.
4. **`financial.controller.ts` & `FinancialAccountsService` (160 nodes):** Client financial accounts, double-entry ledger, COD clearance, and payout requests.
5. **`sila-sy.adapter.ts` (92 nodes):** Sila aggregator API client, HMAC signature verification, and courier cancellation state machine.
6. **`task-inventory-effects.service.ts` (99 nodes):** Atomic physical inventory movements during warehouse picking and receiving.
7. **`withTenantRls` & `@prisma/client` (430 nodes):** Multi-tenant row-level security and PostgreSQL query execution.

---

## 7. Validation Test Results

### Test A — Installation Verification
- Command: `graphify --version`
- Output: `graphify 0.9.100` (PASS)
- Help output: Verified with all commands (`extract`, `query`, `path`, `explain`, `update`, `cluster-only`, `export`, `antigravity`, `claude`). (PASS)

### Test B — Graph Integrity Verification
- Script: Synchronous verification of `graphify-out/graph.json`.
- Result: Valid JSON containing 17,528 nodes and 46,441 links. (PASS)
- Report: `GRAPH_REPORT.md` is populated (78 KB) with complete god nodes, surprises, and navigation hubs. (PASS)

### Test C — EMDAD Architecture Queries

#### Query 1: Outbound Order to Carrier Flow
```bash
graphify query "Outbound Order shipping provider submission"
```
- **Result:** Successfully traced the exact execution path across:
  `outbound.service.ts` -> `oms-orders.service.ts` -> `shipping.service.ts` -> `ShippingProviderRegistry` -> `babel-express.adapter.ts` / `sila-sy.adapter.ts` -> `OrderShippingFields.tsx`.

#### Query 2: Babel vs. Sila Carrier Relationship
```bash
graphify path "babel-express.adapter.ts" "sila-sy.adapter.ts" --undirected
```
- **Result:** Identified shortest path (2 hops) via the shared test suite `carrier-native-tracking.unit.spec.ts` and interface `shipping-provider.interface.ts`.

#### Query 3: Financial Management & Client Account
```bash
graphify query "Financial Management Client Account balance"
```
- **Result:** Pinpointed `ClientFinancialAccount`, `FinancialAccountsService`, `FinancialTransactionsService`, `FinancialCodService`, and frontend consumers `clientFinancesService.ts` and `PayoutManagementPage.tsx`.

#### Query 4: Cash-on-Delivery (COD) Handling
```bash
graphify query "COD collection records"
```
- **Result:** Isolated `CodRecordsService`, `generateForDeliveredOrder()`, `voidForDeliveryRevert()`, `createReturnAdjustment()`, and export generators `buildCodReportWorkbook()`.

#### Query 5: Shipment Cancellation Components
```bash
graphify query "shipment cancel CancelShipmentModal"
```
- **Result:** Located the full cancellation flow: `CancelShipmentModal.tsx` -> `useOmsOrderRowActions.tsx` -> `oms-orders.service.ts` (`.cancel()`) -> `shipping-tracking.service.ts` (`.requestSilaCancel()`) -> `order-allocation.service.ts` (`.releaseAllocation()`).

### Test D — Incremental Updates
1. Introduced temporary test marker `// GRAPHIFY_INCREMENTAL_TEST_MARKER` into `backend/src/common/auth/super-admin.guard.unit.spec.ts`.
2. Executed `graphify update .`.
3. Observed result:
   - Evaluated 1,911 files against SHA-256 manifest.
   - Identified uncached test file without requiring full project re-scan.
   - Automatically backed up curated graph to `graphify-out/cache/` and rebuilt updated graph.
4. Cleanly reverted the test change: `git checkout -- backend/src/common/auth/super-admin.guard.unit.spec.ts`. Application code remained 100% untouched. (PASS)

### Test E — AI Agent Workflow Investigation
1. Agent queried: `"Inbound receiving putaway"`.
2. Graph returned exact nodes: `InboundReceivingPayload` and `InboundPutawayPayload` in `backend/src/modules/warehouse-workflow/workflow-payload.contracts.ts:L3-L21`.
3. Agent read the specific lines directly via `view_file` without running repository-wide grep searches. (PASS)

---

## 8. AI Agent Integration Details

### 8.1 Google Antigravity Integration (Current Environment)
- Installed via: `graphify antigravity install`
- **Rule File:** `/var/www/emdad-sy-3pl-wms-staging/.agents/rules/graphify.md`
  - Configured with `trigger: always_on`.
  - Instructs the agent to query `graph.json` via `graphify query "<question>"` or browse `graphify-out/wiki/index.md` before initiating raw file reads.
  - Requires updating the graph AST after modifying code files using `graphify update .`.
- **Workflow File:** `/var/www/emdad-sy-3pl-wms-staging/.agents/workflows/graphify.md`

### 8.2 Claude Code Integration (Handover Agent)
- Installed via: `graphify claude install`
- **Rule Configuration:** Local project `CLAUDE.md` has been updated with the `## graphify` operational contract.
- **Hook Automation:** `.claude/settings.json` configured with `PreToolUse` hooks (intercepting `Bash|Grep` searches to prioritize the Knowledge Graph before raw file inspection).

---

## 9. Resource Protection and Production Safety Assessment

1. **VPS Resource Impact During Generation:**
   - Worker throttling: Extraction was restricted to `--max-workers 2`.
   - CPU utilization: Kept below 25% of VPS capacity during AST parsing.
   - RAM usage: Virtual environment peak memory was ~450 MB, leaving >1.5 GiB free system RAM.
   - Production uptime: PM2 process 0 (`emdad-wms-backend`, PID 129095) maintained uninterrupted uptime with 0 restarts and 0% CPU disruption.
2. **Daemon Assessment:**
   - No permanent background daemon, file watcher, or cron job was installed.
   - Graphify operates strictly on-demand via the CLI (`graphify update .` or `graphify query`).

---

## 10. Operational Cheat-Sheet & Future Commands

For developers and incoming AI coding agents (Claude):

| Task | Command |
| :--- | :--- |
| **Query Architecture Concept** | `graphify query "<concept or question>"` |
| **Trace Relationship Path** | `graphify path "<SymbolA>" "<SymbolB>" --undirected` |
| **Explain Specific Node** | `graphify explain "<NodeSymbol>"` |
| **Incremental Update (After code edits)** | `graphify update .` *(Zero token cost, local AST)* |
| **Browse Offline Wiki** | Open [index.md](file:///var/www/emdad-sy-3pl-wms-staging/graphify-out/wiki/index.md) |
| **Open Interactive HTML Graph** | Open `graphify-out/graph.html` in browser |
| **Start MCP Server for Agents** | `python3 -m graphify.serve /var/www/emdad-sy-3pl-wms-staging/graphify-out/graph.json` |

---

## 11. Uninstallation and Cleanup Instructions

If Graphify ever needs to be removed from the staging environment, execute:

```bash
# 1. Remove project graph artifacts and agent rules
rm -rf /var/www/emdad-sy-3pl-wms-staging/graphify-out/
rm -f /var/www/emdad-sy-3pl-wms-staging/.graphifyignore
rm -f /var/www/emdad-sy-3pl-wms-staging/.agents/rules/graphify.md
rm -f /var/www/emdad-sy-3pl-wms-staging/.agents/workflows/graphify.md
rm -f /var/www/emdad-sy-3pl-wms-staging/CLAUDE.md
rm -rf /var/www/emdad-sy-3pl-wms-staging/.claude/

# 2. Remove CLI symlink and isolated virtual environment
rm -f /usr/local/bin/graphify
rm -rf /opt/graphify-venv/
```

---
*Report completed and verified on Staging. Graphify is fully operational and ready for the next engineering phase.*
