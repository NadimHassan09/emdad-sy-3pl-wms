# Phase 0 + Phase 1 report — and the G1 decision

## What exists (staging, nothing deployed)
- `web-v2/` npm-workspaces monorepo: `apps/admin` (:5273), `apps/client` (:5274), `packages/ui` (design system), `packages/core` (prefs, format, UI switch).
- **Admin**: login, dashboard (`/dashboard/overview`), OMS Orders list (`/orders/oms`) with all its dialogs, shared `ConfirmDialog`.
- **Client**: login, account-inactive, dashboard, notifications menu, billing/role banners, NotFound.
- Everything else keeps its URL and shows "Open in classic interface" (admin 88, client 26 routes) or redirects (admin 36, client 6).
- Both apps typecheck, lint (0 errors), and build (`npm run build:admin`, `build:client`).
- Checks (`npm run check`): independence ✔, RTL lint ✔, contrast ✔, route-diff ✔ (no classic route lost).
- Visual QA on real staging data: EN/AR × light/dark × 1440/768/390; no horizontal overflow, no console/page errors (only the expected 401 of the unauthenticated bootstrap call).
- Rollout switch (nginx cookie) is **prepared but not applied**: `web-v2/deploy/nginx/`. Legacy remains the default.

## Size facts (lines of TS/TSX)
| | Classic | V2 so far |
|---|---|---|
| Admin app | ~68k | ~3.4k features/layout + shared kit |
| Client app | ~14.7k | ~1.1k features/layout |
| Shared UI kit (new, reusable by every remaining page) | — | ~6.0k |
| Admin OMS Orders list (page + dialogs) | ~3.9k | ~1.8k |

## Honest effort assessment
- **The expensive part was the first of each kind**: the kit (shell, `DataTable`, filters, status system, dialogs), the OMS list (the most complex list in the product: filters, scan, import/export, batches, bulk, ~20 row actions) and the port of auth/realtime/pagination. Those are now reusable.
- Remaining after Phase 1: admin **88** routes to rebuild + client **26**. My page-class estimate (not a per-page audit): ~40 simple lists, ~25 details, ~15 forms/wizards, ~15 heavy ops screens (picking/packing/receiving/scan, reports) for admin; ~9 equivalent for client. Using the OMS list as a unit (1.0), I expect simple list ≈0.3, detail ≈0.4, form ≈0.5, heavy ≈1–1.5 → **roughly 45–55 OMS-list-equivalents** in total. Treat this as ±40 %.
- Per-page cost should now be well below the OMS list because the kit, table contract and port layer exist; the risk is concentrated in the heavy operational screens and in regressions vs. "same function, same data" (needs the parity sheet + a staging pass per module).
- Known deferred items inside Phase 1: OMS Edit modal, Waybill modal, single shipping-details modal, custom page-size input (listed in `parity/phase-1-parity.md`).

## G1 — decision for you
**A. Continue the rewrite** module by module (Orders/OMS → Inbound/Outbound → Inventory → Billing/Reports → Admin/Settings; client alongside), flipping the nginx cookie default per module when its parity sheet is green.
**B. Stop and apply the cheaper fallback**: re-skin the classic apps through `@ds` tokens/primitives (colours, status tones, buttons, spacing). Much cheaper and risk-free for behaviour, but it does **not** fix structural audit items (container-responsive tables, column contract, off-canvas shell at 1024, one status system) page by page.
**C. Hybrid**: keep V2 for the screens already rebuilt (login/dashboard/OMS list) behind the cookie, apply B to the rest, and revisit later.

Recommendation: **A**, starting with the client portal (small: ~9 equivalents, most visible to customers) while the admin OMS module is finished; revisit at the next gate with actual per-page timings.

## Needs from you before any rollout
1. Explicit OK before any nginx reload (shared with production vhosts).
2. Official SVG logo + original banner artwork (placeholders in use) — D4.
3. Rotate the Better Design API key and the staging test passwords — D8.
