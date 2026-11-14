# 07 — Sanity testing (go / no-go after every deploy, ≤ 15 minutes)

Run by one person (or one script) right after `pm2 restart 1` / frontend build. If any **S-P0** item fails: stop, roll back or fix, do not continue with other testing.

| ID | Check | How | Pass |
|---|---|---|---|
| SAN-001 P0 | Backend up | `GET http://127.0.0.1:3001/api/ops/health/live` and `/ready` | 200, DB+Redis ready |
| SAN-002 P0 | PM2 | `pm2 list` → id 1 online, restarts count not increasing; id 0 untouched (not restarted by us) | online |
| SAN-003 P0 | Frontends served | open admin and client URLs; hard reload; `index.html` has new build hash; no 404 on assets | loads |
| SAN-004 P0 | Admin login + `/api/auth/me` | owner session | 200, role super_admin |
| SAN-005 P0 | Client login + `/client/auth/me` | owner session | 200 |
| SAN-006 P0 | One list per area loads with data (dashboard, products, inbound, outbound, OMS, finance overview, billing invoices, shipping companies) | click through | no error toast, counts non-zero |
| SAN-007 P0 | Create + cancel one `QA-` OMS order (Test company/Nadim Hassan/TEST ORDER) | UI | created, status moves, cancelled, stock released |
| SAN-008 P0 | Currency/FX: `/shipping/companies` shows active rate and last success < 24 h | UI | ok |
| SAN-009 P1 | Print: open a waybill | UI | renders, QR visible |
| SAN-010 P1 | Realtime: bell badge / dashboard receives an event | create notification | updates |
| SAN-011 P1 | Export CSV from OMS list | UI | file with rows |
| SAN-012 P1 | Language switch AR/EN and dark mode on dashboard | UI | OK |
| SAN-013 P1 | Backup health shows healthy and last backup < 26 h | UI | |
| SAN-014 P1 | Logs: `pm2 logs 1 --lines 200` no new error stack since restart | | clean |
| SAN-015 P1 | DB migrations status clean | `prisma migrate status` (read-only) | up to date |
| SAN-016 P2 | Mobile 390 px: dashboard + OMS list render without horizontal scroll | device mode | |
| SAN-017 P2 | Webhook endpoint reachable: unsigned POST to `/shipping/webhooks/SENA_EXPRESS` rejected 401/400 (not 500) | curl | |

Report format: one line per check `SAN-00x PASS|FAIL + note`, time of run, build sha.
