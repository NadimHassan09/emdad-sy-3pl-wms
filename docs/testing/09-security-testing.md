# 09 — Security testing

**Scope.** Authentication, authorisation (RBAC + tenant isolation), input handling, file/PDF handling, secrets, transport and headers, third-party integrations, business-logic abuse. Authorised testing of the owner's **staging** only; no DoS beyond the agreed load tests, no attacks against carriers or Google.
**Method.** Automated (OWASP ZAP baseline + authenticated scan, `npm audit`, `gitleaks`/`trufflehog`, nuclei templates, sqlmap in safe mode against QA endpoints only) + manual (Burp-style tampering through the browser/API + role matrix).
**Oracles:** OWASP ASVS L2 as baseline, OWASP API Top 10 (2023), plus the project rules (tenant isolation, append-only finance, no secrets in logs).

## 1. Known observations to verify first (found while preparing the plan — evidence in repo/server)

| ID | Observation | Where | Severity guess | Test |
|---|---|---|---|---|
| SEC-OBS-01 | Demo/QA account password is **committed in the repo** as a literal in `tests/helpers/constants.ts` (accounts `superadmin@emdad.example` etc. exist on staging) | repo | S2 | SEC-SEC-001 — remove from repo, rotate if valid |
| SEC-OBS-02 | `backend/.env.staging-bak` is mode **644** (world-readable) next to `.env` (600) and holds environment secrets; `.env.staging.safe.bak` 600 | `/var/www/emdad-sy-3pl-wms-staging/backend/` | S2 | SEC-SEC-002 — permissions, delete backups, ensure not served/committed |
| SEC-OBS-03 | Auth cookie flag `secure: this.isProduction()` — on staging (HTTPS) cookies may be sent without `Secure` | `auth.service.ts:611-614` | S3 (staging) / S1 if same flag on prod | SEC-AUT-009 |
| SEC-OBS-04 | nginx for the frontends sends HSTS, `nosniff`, `Referrer-Policy` but **no `Content-Security-Policy`, no `X-Frame-Options`/`frame-ancestors`, no `Permissions-Policy`** (helmet covers only API) | `/etc/nginx/sites-enabled/emdad-wms-staging-admin` | S3 | SEC-HDR-001/002 |
| SEC-OBS-05 | `/users/warehouse_users/:id` with a client-user id shows that user's name/email under an error banner (V-038) | UI/API | S3 | SEC-RBAC-020 |
| SEC-OBS-06 | Global throttle 120 req/min per (IP?) — behind nginx all users may share one IP unless trust-proxy is set | `app.module.ts` | S3 | SEC-DOS-002 |
| SEC-OBS-07 | 31 routes annotated `@Public()` (auth, webhooks, forms/submit, health, backups download token, document public signed link) — each needs an explicit review | catalogue | — | SEC-PUB-001…031 |
| SEC-OBS-08 | `GET /auth/me` and several `/client/auth/*` routes appear in the heuristic public list — verify they are guarded by a different guard, not open | catalogue | ? | SEC-AUT-001 |
| SEC-OBS-09 | Leaked `.env` history in git (owner decision pending on rotation, X04 in legacy list) | git history | S1 if secrets valid | SEC-SEC-003 |
| SEC-OBS-10 | Google OAuth client in "Testing" mode returns 403 for non-test users (not a vuln; documents the dependency) | `O13_GOOGLE_SHEETS_403.md` | — | — |

## 2. Authentication (SEC-AUT)

| ID | Test | Expected |
|---|---|---|
| SEC-AUT-001 | Every endpoint in the catalogue called with no/invalid token | 401 except the explicit public list (SEC-PUB); response never 500 |
| SEC-AUT-002 | JWT: alg `none`, wrong secret, expired, `nbf` future, tampered role claim, token of deleted/inactive user, admin token on client API and vice versa | all rejected |
| SEC-AUT-003 | Refresh token: theft/replay (reuse after rotation outside grace), cross-user, after password change, after logout | revoked family; replay inside grace idempotent only for same device fingerprint? (A-xx) |
| SEC-AUT-004 | Login brute force: 20 failures same account, 100 across accounts, distributed IPs (X-Forwarded-For spoof) | throttled/locked without account enumeration; spoofed XFF ignored |
| SEC-AUT-005 | User enumeration: login / forgot password / reset messages and timing for existing vs unknown email | identical |
| SEC-AUT-006 | Password reset: code entropy, TTL, attempt limit, single use, link reuse, token in logs, host-header poisoning in email link | OK |
| SEC-AUT-007 | Password policy and storage (bcrypt/argon2 cost), change-password requires current password, session invalidation on change | |
| SEC-AUT-008 | "Remember me" and logout: cookies cleared, server session revoked, Back button after logout shows no private data | |
| SEC-AUT-009 | Cookie attributes in staging and production config: `HttpOnly`, `Secure` (must be true over HTTPS), `SameSite`, path, domain, lifetime 30 d only with remember-me | SEC-OBS-03 |
| SEC-AUT-010 | CSRF: state-changing request from another origin with cookie auth (SameSite=Lax) — POST/PATCH/DELETE via cross-site form/fetch | blocked (CORS + token/Origin check) |
| SEC-AUT-011 | CORS: allowed origins list exact; `null` origin, wildcard subdomain, reflected origin, credentials | only the two staging/prod origins |
| SEC-AUT-012 | Session fixation / concurrent sessions / device list | |
| SEC-AUT-013 | Suspended/inactive account: existing session stops within N minutes; Google sign-in cannot revive it | |
| SEC-AUT-014 | Google OAuth (if re-enabled): state & nonce, redirect_uri exactness, scope minimal (`spreadsheets`, `drive.file`), token storage encrypted, unlink | |
| SEC-AUT-015 | Client API keys: stored hashed, shown once, regenerate invalidates, revoke immediate, rate limit, scope per key, key in URL not accepted | |

## 3. Authorisation — RBAC matrix (SEC-RBAC) — P0

**Roles (10):** super_admin, wh_manager, wh_operator, finance (accountant), viewer, inventory_controller, custom role "QA Ops lead", client_admin, client_staff, anonymous.
**Method:** auto-generate a matrix *endpoint × role* from the catalogue + `rbac.ts` + guard code; call every endpoint with every role; compare to expected (from `rbac.ts` for UI, `InternalAdminGuard`/`@Roles` for API). Also *UI route × role* (88 + 33 routes): direct URL.

| ID | Test | Expected |
|---|---|---|
| SEC-RBAC-001 | Full matrix: 594 endpoints × 10 roles = 5,940 calls with safe payloads | no cell where a forbidden role gets 2xx; no 500; matrix saved as CSV |
| SEC-RBAC-002 | UI routes × roles direct URL | forbidden → redirect/403 page, no flash of content, no API data fetched |
| SEC-RBAC-003 | UI vs API parity: buttons hidden for a role are also forbidden by API; allowed by API ⇒ visible (or documented) | parity table |
| SEC-RBAC-004 | Privilege escalation: wh_manager creating super_admin, user editing own role, client_staff calling client_admin-only endpoints (API keys, webhooks, Sheets, finances) | blocked |
| SEC-RBAC-005 | Custom role: permission read vs write enforcement per module; permission removed → effect without re-login | |
| SEC-RBAC-006 | Finance data (carrier costs, margin) never to client roles or wh_operator/inventory | 403 |
| SEC-RBAC-007 | Viewer cannot mutate anything incl. exports that trigger writes, PDF generation that stores files | |
| SEC-RBAC-008 | wh_operator limited to tasks execution endpoints | |
| SEC-RBAC-020 | Cross-list user detail (client user id under warehouse path and reverse) — no name/email in body or header | V-038 |

## 4. Tenant isolation (SEC-TEN) — P0

| ID | Test | Expected |
|---|---|---|
| SEC-TEN-001 | IDOR sweep: for every `:id` endpoint, use ids from company B with company A token (IDs harvested via admin) | 404/403 everywhere; DB diff empty |
| SEC-TEN-002 | Mass assignment: send `companyId`/`clientId` in body to override tenant | ignored/403 |
| SEC-TEN-003 | Query/filter injection to widen scope: `?companyId=`, `?clientId=`, `X-Company-Id` for client roles | ignored |
| SEC-TEN-004 | Export/report/PDF/sheet/webhook payloads contain only own tenant rows (grep for foreign ids/names) | |
| SEC-TEN-005 | Websocket: subscribe to another tenant's room, guess event names | denied |
| SEC-TEN-006 | RLS at DB: connect with the app role, `SET app.company_id` absent/wrong → 0 rows; can the app role `SET ROLE`/disable RLS? | no |
| SEC-TEN-007 | Signed public document links (`/documents/public/:id/:filename?exp&sig`): tamper `id`, `exp`, `sig`, reuse after expiry, enumeration | 403; timing-safe compare present |
| SEC-TEN-008 | Media endpoints `/client/media/products/:id/...` with other tenant ids | 404 |

## 5. Input handling (SEC-INP)

| ID | Test | Expected |
|---|---|---|
| SEC-INP-001 | SQL injection in all string params/filters/sort fields (`'`, `" OR 1=1 --`, `;SELECT pg_sleep(5)`), incl. raw-SQL services (search `$queryRaw` usage) | no error leak, no delay, whitelist sort |
| SEC-INP-002 | XSS stored/reflected/DOM in every text field → rendered in lists, details, PDFs, exports, emails, notifications, audit JSON viewer, toasts | escaped everywhere (regression D-024/D-026) |
| SEC-INP-003 | **PDF/HTML-to-PDF injection** (headless browser renders HTML): `<script>`, `<iframe src=file:///etc/passwd>`, `<img src=http://169.254.169.254>`, CSS `url()`, `@import`, SVG external refs in waybill/GRN/DN/contract/invoice/instruction/return slip | blocked; no SSRF/LFI; JS disabled in renderer |
| SEC-INP-004 | CSV/Excel formula injection (`=cmd|' /C calc'!A0`, `=HYPERLINK(...)`, `@SUM`, leading tab) in every exportable field | neutralised with `'` prefix |
| SEC-INP-005 | Import files: zip bomb xlsx, XXE in xlsx XML, macro-enabled, 100 MB, 1 M rows, malformed encoding, billion-laughs | rejected within limits; no parser crash |
| SEC-INP-006 | File upload (profile photo, product image, imports, sheets): MIME vs extension, polyglots, SVG with script, double extensions, path traversal in filename, EXIF, size limit vs nginx 25 MB | stored safe, served with correct content-type + `nosniff` |
| SEC-INP-007 | Path traversal/LFI in download endpoints (`/backups/:id/download`, documents, media): `../`, encoded, null byte | blocked |
| SEC-INP-008 | SSRF: FX custom API URL, webhook URL (client), Sheets URL, carrier base URL overrides: localhost, 127.0.0.1, 169.254.169.254, 10/8, DNS rebinding, redirects to internal, `file://`, `gopher://` | blocked; https only |
| SEC-INP-009 | Command injection in backup/pg_dump parameters (labels, schedule names, file names) | no shell interpolation |
| SEC-INP-010 | Mass assignment / unknown fields (`forbidNonWhitelisted` is on — confirm for every DTO incl. query DTOs) | 400 |
| SEC-INP-011 | Type confusion: arrays/objects where strings expected, huge numbers, negative qty, NaN, `__proto__`, `constructor.prototype` | 400, no prototype pollution |
| SEC-INP-012 | Unicode: RTL override (U+202E), zero-width, homoglyphs in names/SKU/emails, very long Arabic strings | normalised/rejected where identifiers |
| SEC-INP-013 | HTTP: request smuggling/large headers/many params/JSON depth 10,000/body 26 MB | 4xx not 5xx |
| SEC-INP-014 | Open redirect (`next=`/`redirect=` params after login, OAuth `redirect_uri`) | whitelist |
| SEC-INP-015 | Header injection / CRLF in filenames (`Content-Disposition`) | sanitised |

## 6. Business-logic abuse (SEC-BIZ)

| ID | Test | Expected |
|---|---|---|
| SEC-BIZ-001 | Replay of payout request / COD remit / invoice settle / adjustment approve (double spend) | idempotent; one effect |
| SEC-BIZ-002 | Negative / fractional / huge quantities & amounts; qty 0 lines; price edit on cells (invoice) beyond limits | validation |
| SEC-BIZ-003 | State skipping via API (ship before approve, receive before confirm, edit after finalise) | 409 |
| SEC-BIZ-004 | Client edits order after admin approval via Sheets/API/UI/import/PATCH | refused server-side (S #13) |
| SEC-BIZ-005 | Client sets own shipping fee/COD/discount/prices in create payload | ignored/validated |
| SEC-BIZ-006 | Race conditions: double allocate, double ship, double remit, parallel invoice creation for same period | no duplicates |
| SEC-BIZ-007 | Finance append-only: attempt UPDATE/DELETE through any endpoint or SQL role used by app | impossible |
| SEC-BIZ-008 | Client cannot read carrier cost / margin / internal notes / audit logs / other clients' pricing | DTO deny-list scan |
| SEC-BIZ-009 | Admin edit of carrier cost requires reason + audit; super admin override logged | |
| SEC-BIZ-010 | Rate-limit abuse of external API keys (order flood), webhook flood | throttled |
| SEC-BIZ-011 | Account restriction bypass (restricted client creating orders via API key) | blocked |
| SEC-BIZ-012 | Factory reset / restore: role, confirmation phrase, cooldown, audit, disabled by env on production | cannot run accidentally |

## 7. Webhooks and integrations (SEC-WH, SEC-3P)

| ID | Test | Expected |
|---|---|---|
| SEC-WH-001 | Inbound carrier webhooks: no signature / wrong / valid / old timestamp / replay / oversized | 401/200 semantics; timing-safe compare |
| SEC-WH-002 | Inbound channel webhook `/oms/webhooks/inbound/:channelId`: guess channelId, wrong secret, forged payload creating orders | needs secret; per-channel scope |
| SEC-WH-003 | Outgoing client webhooks: https only, signature header with timestamp, retry limits, redirects not followed to internal hosts | |
| SEC-WH-004 | Public form `/forms/submit`: spam, throttle, size, HTML | |
| SEC-3P-001 | Carrier credentials stored encrypted; never in API responses/logs/DOM; Test connection does not echo secrets | |
| SEC-3P-002 | Google credentials (Settings page): masked; only super admin; never logged | |
| SEC-3P-003 | SMTP credentials/emails: no sensitive data in email, links https | |
| SEC-3P-004 | Dependency audit: `npm audit` (backend/frontend/client), SBOM, outdated majors; Dockerfiles | no critical/high without waiver |

## 8. Transport, headers, config (SEC-HDR, SEC-CFG)

| ID | Test | Expected |
|---|---|---|
| SEC-HDR-001 | Admin + client frontends: CSP, X-Frame-Options/frame-ancestors, Permissions-Policy, COOP/CORP, Referrer-Policy, nosniff, HSTS preload | present (SEC-OBS-04) |
| SEC-HDR-002 | Clickjacking: embed pages in an iframe from another origin | refused (note: the QA screenshot harness itself used same-origin iframes — it must keep working only same-origin) |
| SEC-HDR-003 | API headers (helmet): `X-Powered-By` removed, cache-control no-store on auth/finance, CORS preflight | |
| SEC-CFG-001 | TLS: protocols/ciphers (SSL Labs-style via `testssl.sh`) — staging uses a self-signed cert on the VPS IP; production cert chain | TLS ≥ 1.2 |
| SEC-CFG-002 | Exposed files: `/.env`, `/.git`, `/backups`, source maps, `/api/docs`/swagger, `/ops/*` metrics, directory listing, backup download paths, `/storage/documents` | not reachable |
| SEC-CFG-003 | Source maps and debug flags in production builds; `NODE_ENV`; verbose errors | none |
| SEC-CFG-004 | Error pages: 404/500 do not reveal stack/paths/versions | |
| SEC-CFG-005 | Logging: no passwords/tokens/Google/carrier secrets (grep PM2 logs after the whole run) | none |
| SEC-CFG-006 | Secrets inventory: `.env`, `.env.staging-bak`, `.env.staging.safe.bak`, git history (gitleaks), docker-compose files, `edits.txt`, `scratch/`, `tmp/` in repo root | none valid in repo; permissions 600 |
| SEC-CFG-007 | Process/OS: PM2 user (root!), DB role privileges (app role superuser?), Redis auth, open ports (`ss -tlnp`), firewall | least privilege |
| SEC-CFG-008 | Backups: encryption at rest, access control on download tokens, retention, offsite copy; restore only to scratch | |
| SEC-CFG-009 | Prod/staging separation: staging cannot reach prod DB; shared secrets/JWT keys differ | |

## 9. Public endpoints review (SEC-PUB) — each of the 31 `@Public()` routes
List in `generated/ENDPOINT_CATALOGUE.md` (`public` column). For each: purpose, what protects it (token, signature, rate limit, none), what an anonymous caller can learn/do, and a test per protection. Includes: login/refresh/logout/reset (client + admin), Google OAuth callbacks, `/forms/submit`, `/ops/health/*`, `/shipping/webhooks/:providerCode`, `/oms/webhooks/inbound/:channelId`, `/backups/:id/download?token`, `/documents/public/:id/:filename`.

## 10. Reporting
Each finding: ID, CVSS-style severity, exact request/response (secrets redacted), impact, fix recommendation, retest result. Release rule: no open critical/high; mediums need owner waiver.
