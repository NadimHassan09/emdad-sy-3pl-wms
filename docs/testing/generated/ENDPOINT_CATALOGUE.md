# Generated endpoint catalogue

Total routes: **594**. Source: `backend/src/**/*.controller.ts`. Regenerate with `python3 docs/testing/generated/gen_inventory.py`.

| # | Module | Method | Path | Method-level auth annotation (heuristic: verify in code) | Guards | Controller |
|---|---|---|---|---|---|---|
| E001 | adjustments | POST | /adjustments |  |  | adjustments.controller.ts |
| E002 | adjustments | GET | /adjustments |  |  | adjustments.controller.ts |
| E003 | adjustments | GET | /adjustments/:id |  |  | adjustments.controller.ts |
| E004 | adjustments | PATCH | /adjustments/:id |  |  | adjustments.controller.ts |
| E005 | adjustments | POST | /adjustments/:id/lines |  |  | adjustments.controller.ts |
| E006 | adjustments | PATCH | /adjustments/:id/lines/:lineId |  |  | adjustments.controller.ts |
| E007 | adjustments | POST | /adjustments/:id/approve |  | InternalAdminGuard | adjustments.controller.ts |
| E008 | adjustments | POST | /adjustments/:id/cancel |  |  | adjustments.controller.ts |
| E009 | audit-logs | GET | /audit-logs/policy |  | RolesGuard, InternalAdminGuard | audit-logs.controller.ts |
| E010 | audit-logs | GET | /audit-logs/export |  | InternalAdminGuard | audit-logs.controller.ts |
| E011 | audit-logs | GET | /audit-logs/archival-candidates |  | RolesGuard, InternalAdminGuard | audit-logs.controller.ts |
| E012 | audit-logs | GET | /audit-logs |  | RolesGuard, InternalAdminGuard | audit-logs.controller.ts |
| E013 | audit-logs | GET | /audit-logs/:id |  | RolesGuard, InternalAdminGuard | audit-logs.controller.ts |
| E014 | auth | POST | /auth/login | public |  | auth.controller.ts |
| E015 | auth | POST | /auth/refresh | public |  | auth.controller.ts |
| E016 | auth | POST | /auth/logout | public |  | auth.controller.ts |
| E017 | auth | GET | /auth/me | public |  | auth.controller.ts |
| E018 | auth | GET | /auth/google/status | public |  | auth.controller.ts |
| E019 | auth | GET | /auth/google/login | public |  | auth.controller.ts |
| E020 | auth | GET | /auth/google/link |  |  | auth.controller.ts |
| E021 | auth | GET | /auth/google/callback | public |  | auth.controller.ts |
| E022 | auth | POST | /auth/google/unlink |  |  | auth.controller.ts |
| E023 | auth | POST | /auth/avatar |  |  | auth.controller.ts |
| E024 | auth | DELETE | /auth/avatar |  |  | auth.controller.ts |
| E025 | auth | PATCH | /auth/profile |  |  | auth.controller.ts |
| E026 | auth | POST | /auth/change-password |  |  | auth.controller.ts |
| E027 | auth | POST | /auth/request-reset | public |  | auth.controller.ts |
| E028 | auth | POST | /auth/reset-password | public |  | auth.controller.ts |
| E029 | backups | GET | /integrations/google-drive/auth-url |  | SuperAdminGuard | backup-drive.controller.ts |
| E030 | backups | GET | /integrations/google-drive/callback | public | RolesGuard | backup-drive.controller.ts |
| E031 | backups | DELETE | /integrations/google-drive |  | SuperAdminGuard | backup-drive.controller.ts |
| E032 | backups | POST | /integrations/google-drive/test |  | SuperAdminGuard | backup-drive.controller.ts |
| E033 | backups | GET | /integrations/google-drive/status |  | InternalAdminGuard | backup-drive.controller.ts |
| E034 | backups | GET | /backups/manual-cooldown |  | RolesGuard, SuperAdminGuard | backup-manual-cooldown.controller.ts |
| E035 | backups | PUT | /backups/manual-cooldown |  | RolesGuard, SuperAdminGuard | backup-manual-cooldown.controller.ts |
| E036 | backups | GET | /backups/retention/policies |  | InternalAdminGuard | backup-retention.controller.ts |
| E037 | backups | GET | /backups/retention/preview |  | InternalAdminGuard | backup-retention.controller.ts |
| E038 | backups | POST | /backups/retention/cleanup |  | SuperAdminGuard | backup-retention.controller.ts |
| E039 | backups | GET | /backups/retention/drive/policies |  | InternalAdminGuard | backup-retention.controller.ts |
| E040 | backups | GET | /backups/retention/drive/preview |  | InternalAdminGuard | backup-retention.controller.ts |
| E041 | backups | POST | /backups/retention/drive/cleanup |  | SuperAdminGuard | backup-retention.controller.ts |
| E042 | backups | GET | /backups/schedules |  | InternalAdminGuard | backup-schedules.controller.ts |
| E043 | backups | GET | /backups/schedules/:id |  | InternalAdminGuard | backup-schedules.controller.ts |
| E044 | backups | POST | /backups/schedules |  | SuperAdminGuard | backup-schedules.controller.ts |
| E045 | backups | PATCH | /backups/schedules/:id |  | SuperAdminGuard | backup-schedules.controller.ts |
| E046 | backups | POST | /backups/schedules/:id/run-now |  | SuperAdminGuard | backup-schedules.controller.ts |
| E047 | backups | GET | /backups/storage-policy |  | InternalAdminGuard | backup-storage-policy.controller.ts |
| E048 | backups | PUT | /backups/storage-policy |  | SuperAdminGuard | backup-storage-policy.controller.ts |
| E049 | backups | GET | /backups/health |  | InternalAdminGuard | backups.controller.ts |
| E050 | backups | POST | /backups/health/evaluate-alerts |  | SuperAdminGuard | backups.controller.ts |
| E051 | backups | GET | /backups/operations/active |  | InternalAdminGuard | backups.controller.ts |
| E052 | backups | POST | /backups/upload |  | SuperAdminGuard | backups.controller.ts |
| E053 | backups | POST | /backups/factory-reset |  | SuperAdminGuard | backups.controller.ts |
| E054 | backups | POST | /backups |  | SuperAdminGuard | backups.controller.ts |
| E055 | backups | GET | /backups |  | InternalAdminGuard | backups.controller.ts |
| E056 | backups | POST | /backups/:id/sync-drive |  | SuperAdminGuard | backups.controller.ts |
| E057 | backups | POST | /backups/:id/restore |  | SuperAdminGuard | backups.controller.ts |
| E058 | backups | GET | /backups/:id/status |  | InternalAdminGuard | backups.controller.ts |
| E059 | backups | POST | /backups/:id/download-url |  | SuperAdminGuard | backups.controller.ts |
| E060 | backups | GET | /backups/:id/download | public | RolesGuard | backups.controller.ts |
| E061 | backups | GET | /backups/:id |  | InternalAdminGuard | backups.controller.ts |
| E062 | billing | GET | /billing/storage-usage |  | InternalAdminGuard | billing.controller.ts |
| E063 | billing | GET | /billing/incentive-check |  | InternalAdminGuard | billing.controller.ts |
| E064 | billing | GET | /billing/invoice-orders |  | InternalAdminGuard | billing.controller.ts |
| E065 | billing | GET | /billing/capacity |  | InternalAdminGuard | billing.controller.ts |
| E066 | billing | GET | /billing/companies/:companyId/storage |  | InternalAdminGuard | billing.controller.ts |
| E067 | billing | GET | /billing/plans |  |  | billing.controller.ts |
| E068 | billing | GET | /billing/plans/:id |  |  | billing.controller.ts |
| E069 | billing | POST | /billing/plans |  | InternalAdminGuard | billing.controller.ts |
| E070 | billing | PATCH | /billing/plans/:id |  | InternalAdminGuard | billing.controller.ts |
| E071 | billing | POST | /billing/plans/:id/renew |  | InternalAdminGuard | billing.controller.ts |
| E072 | billing | GET | /billing/cycles |  |  | billing.controller.ts |
| E073 | billing | GET | /billing/cycles/expiring-soon |  |  | billing.controller.ts |
| E074 | billing | GET | /billing/cycles/:id |  |  | billing.controller.ts |
| E075 | billing | POST | /billing/cycles/:id/renew |  | InternalAdminGuard | billing.controller.ts |
| E076 | billing | GET | /billing/invoices |  |  | billing.controller.ts |
| E077 | billing | GET | /billing/invoices/export |  |  | billing.controller.ts |
| E078 | billing | POST | /billing/invoices/ad-hoc |  | InternalAdminGuard | billing.controller.ts |
| E079 | billing | GET | /billing/charge-rules/:companyId |  | InternalAdminGuard | billing.controller.ts |
| E080 | billing | PUT | /billing/charge-rules/:companyId |  | InternalAdminGuard | billing.controller.ts |
| E081 | billing | POST | /billing/invoices/on-demand/preview |  | InternalAdminGuard | billing.controller.ts |
| E082 | billing | POST | /billing/invoices/on-demand |  | InternalAdminGuard | billing.controller.ts |
| E083 | billing | POST | /billing/invoices/:id/settle |  | InternalAdminGuard | billing.controller.ts |
| E084 | billing | GET | /billing/invoices/:id/breakdown |  |  | billing.controller.ts |
| E085 | billing | PATCH | /billing/invoices/:id/order-items/:orderItemId |  | InternalAdminGuard | billing.controller.ts |
| E086 | billing | GET | /billing/dashboard/summary |  |  | billing.controller.ts |
| E087 | billing | GET | /billing/dashboard/expiring-buckets |  |  | billing.controller.ts |
| E088 | billing | GET | /billing/preview |  |  | billing.controller.ts |
| E089 | billing | GET | /billing/dashboard/overdue-clients |  |  | billing.controller.ts |
| E090 | billing | GET | /billing/dashboard/recent-invoices |  |  | billing.controller.ts |
| E091 | billing | GET | /billing/dashboard/suspended-accounts |  |  | billing.controller.ts |
| E092 | billing | GET | /billing/invoices/:id |  |  | billing.controller.ts |
| E093 | billing | GET | /billing/invoices/:id/pdf |  |  | billing.controller.ts |
| E094 | billing | PATCH | /billing/invoices/:id |  | InternalAdminGuard | billing.controller.ts |
| E095 | billing | POST | /billing/invoices/:id/issue |  | InternalAdminGuard | billing.controller.ts |
| E096 | billing | PATCH | /billing/invoices/:id/status |  | InternalAdminGuard | billing.controller.ts |
| E097 | billing | POST | /billing/invoices/:id/lines |  | InternalAdminGuard | billing.controller.ts |
| E098 | billing | PATCH | /billing/invoices/:id/lines/:lineId |  | InternalAdminGuard | billing.controller.ts |
| E099 | billing | DELETE | /billing/invoices/:id/lines/:lineId |  | InternalAdminGuard | billing.controller.ts |
| E100 | billing | GET | /billing/order-charges |  |  | billing.controller.ts |
| E101 | billing | POST | /billing/order-charges |  | InternalAdminGuard | billing.controller.ts |
| E102 | billing | PATCH | /billing/order-charges/:id |  | InternalAdminGuard | billing.controller.ts |
| E103 | billing | DELETE | /billing/order-charges/:id |  | InternalAdminGuard | billing.controller.ts |
| E104 | client-portal | GET | /client/apis |  | JwtClientAuthGuard | api-credentials.controller.ts |
| E105 | client-portal | POST | /client/apis |  | JwtClientAuthGuard | api-credentials.controller.ts |
| E106 | client-portal | GET | /client/apis/docs/:scope |  | JwtClientAuthGuard | api-credentials.controller.ts |
| E107 | client-portal | POST | /client/apis/:id/regenerate |  | JwtClientAuthGuard | api-credentials.controller.ts |
| E108 | client-portal | POST | /client/apis/:id/revoke |  | JwtClientAuthGuard | api-credentials.controller.ts |
| E109 | client-portal | PATCH | /client/apis/:id/enabled |  | JwtClientAuthGuard | api-credentials.controller.ts |
| E110 | client-portal | GET | /client/apis/:id/docs |  | JwtClientAuthGuard | api-credentials.controller.ts |
| E111 | client-portal | POST | /client/auth/login | public |  | client-auth.controller.ts |
| E112 | client-portal | POST | /client/auth/logout | public |  | client-auth.controller.ts |
| E113 | client-portal | GET | /client/auth/me | public | JwtClientAuthGuard | client-auth.controller.ts |
| E114 | client-portal | POST | /client/auth/avatar | public | JwtClientAuthGuard | client-auth.controller.ts |
| E115 | client-portal | DELETE | /client/auth/avatar | public | JwtClientAuthGuard | client-auth.controller.ts |
| E116 | client-portal | PATCH | /client/auth/profile | public | JwtClientAuthGuard | client-auth.controller.ts |
| E117 | client-portal | POST | /client/auth/change-password | public | JwtClientAuthGuard | client-auth.controller.ts |
| E118 | client-portal | POST | /client/auth/request-reset | public |  | client-auth.controller.ts |
| E119 | client-portal | POST | /client/auth/reset-password | public |  | client-auth.controller.ts |
| E120 | client-portal | GET | /client/auth/google/status | public |  | client-auth.controller.ts |
| E121 | client-portal | GET | /client/auth/google/login | public |  | client-auth.controller.ts |
| E122 | client-portal | GET | /client/auth/google/callback | public |  | client-auth.controller.ts |
| E123 | client-portal | GET | /client/auth/google/link | public | JwtClientAuthGuard | client-auth.controller.ts |
| E124 | client-portal | GET | /client/auth/google/link-callback | public |  | client-auth.controller.ts |
| E125 | client-portal | POST | /client/auth/google/unlink |  | JwtClientAuthGuard | client-auth.controller.ts |
| E126 | client-portal | GET | /client/billing/access |  | JwtClientAuthGuard | client-billing.controller.ts |
| E127 | client-portal | GET | /client/billing/summary |  | JwtClientAuthGuard | client-billing.controller.ts |
| E128 | client-portal | GET | /client/billing/invoices |  | JwtClientAuthGuard | client-billing.controller.ts |
| E129 | client-portal | GET | /client/billing/invoices/export |  | JwtClientAuthGuard | client-billing.controller.ts |
| E130 | client-portal | GET | /client/billing/invoices/:id/breakdown |  | JwtClientAuthGuard | client-billing.controller.ts |
| E131 | client-portal | GET | /client/billing/invoices/:id |  | JwtClientAuthGuard | client-billing.controller.ts |
| E132 | client-portal | GET | /client/dashboard/overview |  | JwtClientAuthGuard | client-dashboard.controller.ts |
| E133 | client-portal | POST | /v1/inbound/orders |  | ApiKeyGuard | external-inbound.controller.ts |
| E134 | client-portal | GET | /v1/inbound/orders |  | ApiKeyGuard | external-inbound.controller.ts |
| E135 | client-portal | GET | /v1/inbound/orders/:idOrNumber |  | ApiKeyGuard | external-inbound.controller.ts |
| E136 | client-portal | POST | /v1/oms/orders |  | ApiKeyGuard | external-oms.controller.ts |
| E137 | client-portal | GET | /v1/oms/orders |  | ApiKeyGuard | external-oms.controller.ts |
| E138 | client-portal | GET | /v1/oms/orders/:idOrNumber |  | ApiKeyGuard | external-oms.controller.ts |
| E139 | client-portal | POST | /v1/outbound/orders |  | ApiKeyGuard | external-outbound.controller.ts |
| E140 | client-portal | GET | /v1/outbound/orders |  | ApiKeyGuard | external-outbound.controller.ts |
| E141 | client-portal | GET | /v1/outbound/orders/:idOrNumber |  | ApiKeyGuard | external-outbound.controller.ts |
| E142 | client-portal | GET | /client/inbound-orders |  | JwtClientAuthGuard | client-inbound-orders.controller.ts |
| E143 | client-portal | GET | /client/inbound-orders/import/template |  | JwtClientAuthGuard | client-inbound-orders.controller.ts |
| E144 | client-portal | POST | /client/inbound-orders/import |  | JwtClientAuthGuard | client-inbound-orders.controller.ts |
| E145 | client-portal | GET | /client/inbound-orders/export/columns |  | JwtClientAuthGuard | client-inbound-orders.controller.ts |
| E146 | client-portal | POST | /client/inbound-orders/export |  | JwtClientAuthGuard | client-inbound-orders.controller.ts |
| E147 | client-portal | GET | /client/inbound-orders/:id |  | JwtClientAuthGuard | client-inbound-orders.controller.ts |
| E148 | client-portal | POST | /client/inbound-orders |  | JwtClientAuthGuard | client-inbound-orders.controller.ts |
| E149 | client-portal | PATCH | /client/inbound-orders/:id |  | JwtClientAuthGuard | client-inbound-orders.controller.ts |
| E150 | client-portal | DELETE | /client/inbound-orders/:id |  | JwtClientAuthGuard | client-inbound-orders.controller.ts |
| E151 | client-portal | POST | /client/products/:id/image |  | JwtClientAuthGuard | client-media.controller.ts |
| E152 | client-portal | DELETE | /client/products/:id/image |  | JwtClientAuthGuard | client-media.controller.ts |
| E153 | client-portal | GET | /client/media/products/:id |  | JwtClientAuthGuard | client-media.controller.ts |
| E154 | client-portal | GET | /client/notifications |  | JwtClientAuthGuard | client-notifications.controller.ts |
| E155 | client-portal | PATCH | /client/notifications/:id/read |  | JwtClientAuthGuard | client-notifications.controller.ts |
| E156 | client-portal | POST | /client/notifications/read-all |  | JwtClientAuthGuard | client-notifications.controller.ts |
| E157 | client-portal | GET | /client/oms/returns |  | JwtClientAuthGuard | client-oms-returns.controller.ts |
| E158 | client-portal | GET | /client/oms/returns/export |  | JwtClientAuthGuard | client-oms-returns.controller.ts |
| E159 | client-portal | GET | /client/oms/returns/:id |  | JwtClientAuthGuard | client-oms-returns.controller.ts |
| E160 | client-portal | POST | /client/oms/returns |  | JwtClientAuthGuard | client-oms-returns.controller.ts |
| E161 | client-portal | GET | /client/oms/orders |  | JwtClientAuthGuard | client-oms-orders.controller.ts |
| E162 | client-portal | GET | /client/oms/orders/nav-counts |  | JwtClientAuthGuard | client-oms-orders.controller.ts |
| E163 | client-portal | GET | /client/oms/orders/status-summary |  | JwtClientAuthGuard | client-oms-orders.controller.ts |
| E164 | client-portal | GET | /client/oms/orders/import/template |  | JwtClientAuthGuard | client-oms-orders.controller.ts |
| E165 | client-portal | POST | /client/oms/orders/import |  | JwtClientAuthGuard | client-oms-orders.controller.ts |
| E166 | client-portal | POST | /client/oms/orders |  | JwtClientAuthGuard | client-oms-orders.controller.ts |
| E167 | client-portal | POST | /client/oms/orders/confirm-bulk |  | JwtClientAuthGuard | client-oms-orders.controller.ts |
| E168 | client-portal | POST | /client/oms/orders/cancel-bulk |  | JwtClientAuthGuard | client-oms-orders.controller.ts |
| E169 | client-portal | GET | /client/oms/orders/export/columns |  | JwtClientAuthGuard | client-oms-orders.controller.ts |
| E170 | client-portal | POST | /client/oms/orders/export |  | JwtClientAuthGuard | client-oms-orders.controller.ts |
| E171 | client-portal | PATCH | /client/oms/orders/:id |  | JwtClientAuthGuard | client-oms-orders.controller.ts |
| E172 | client-portal | DELETE | /client/oms/orders/:id |  | JwtClientAuthGuard | client-oms-orders.controller.ts |
| E173 | client-portal | POST | /client/oms/orders/:id/confirm |  | JwtClientAuthGuard | client-oms-orders.controller.ts |
| E174 | client-portal | POST | /client/oms/orders/:id/cancel |  | JwtClientAuthGuard | client-oms-orders.controller.ts |
| E175 | client-portal | POST | /client/oms/orders/:id/cancel-revert |  | JwtClientAuthGuard | client-oms-orders.controller.ts |
| E176 | client-portal | GET | /client/oms/orders/:id |  | JwtClientAuthGuard | client-oms-orders.controller.ts |
| E177 | client-portal | GET | /client/oms/orders/:id/timeline |  | JwtClientAuthGuard | client-oms-orders.controller.ts |
| E178 | client-portal | GET | /client/oms/orders/:id/shipping-movement |  | JwtClientAuthGuard | client-oms-orders.controller.ts |
| E179 | client-portal | GET | /client/oms/cod-report/export |  | JwtClientAuthGuard | client-oms-orders.controller.ts |
| E180 | client-portal | GET | /client/oms/cod-report |  | JwtClientAuthGuard | client-oms-orders.controller.ts |
| E181 | client-portal | GET | /client/outbound-orders |  | JwtClientAuthGuard | client-outbound-orders.controller.ts |
| E182 | client-portal | GET | /client/outbound-orders/import/template |  | JwtClientAuthGuard | client-outbound-orders.controller.ts |
| E183 | client-portal | POST | /client/outbound-orders/import |  | JwtClientAuthGuard | client-outbound-orders.controller.ts |
| E184 | client-portal | GET | /client/outbound-orders/export/columns |  | JwtClientAuthGuard | client-outbound-orders.controller.ts |
| E185 | client-portal | POST | /client/outbound-orders/export |  | JwtClientAuthGuard | client-outbound-orders.controller.ts |
| E186 | client-portal | GET | /client/outbound-orders/:id |  | JwtClientAuthGuard | client-outbound-orders.controller.ts |
| E187 | client-portal | POST | /client/outbound-orders |  | JwtClientAuthGuard | client-outbound-orders.controller.ts |
| E188 | client-portal | PATCH | /client/outbound-orders/:id |  | JwtClientAuthGuard | client-outbound-orders.controller.ts |
| E189 | client-portal | DELETE | /client/outbound-orders/:id |  | JwtClientAuthGuard | client-outbound-orders.controller.ts |
| E190 | client-portal | GET | /client/products |  | JwtClientAuthGuard | client-products.controller.ts |
| E191 | client-portal | GET | /client/products/export |  | JwtClientAuthGuard | client-products.controller.ts |
| E192 | client-portal | GET | /client/products/:id |  | JwtClientAuthGuard | client-products.controller.ts |
| E193 | client-portal | POST | /client/products |  | JwtClientAuthGuard | client-products.controller.ts |
| E194 | client-portal | PATCH | /client/products/:id |  | JwtClientAuthGuard | client-products.controller.ts |
| E195 | client-portal | DELETE | /client/products/:id |  | JwtClientAuthGuard | client-products.controller.ts |
| E196 | client-portal | GET | /client/returns |  | JwtClientAuthGuard | client-returns.controller.ts |
| E197 | client-portal | GET | /client/returns/outbound-quota/:outboundId |  | JwtClientAuthGuard | client-returns.controller.ts |
| E198 | client-portal | GET | /client/returns/:id |  | JwtClientAuthGuard | client-returns.controller.ts |
| E199 | client-portal | POST | /client/returns |  | JwtClientAuthGuard | client-returns.controller.ts |
| E200 | client-portal | GET | /client/sheets/google/authorize |  | JwtClientAuthGuard | client-sheets-google.controller.ts |
| E201 | client-portal | GET | /client/sheets/google/callback |  |  | client-sheets-google.controller.ts |
| E202 | client-portal | GET | /client/sheets/google/status |  | JwtClientAuthGuard | client-sheets-google.controller.ts |
| E203 | client-portal | GET | /client/sheets/google/create-sheet |  | JwtClientAuthGuard | client-sheets-google.controller.ts |
| E204 | client-portal | DELETE | /client/sheets/google/disconnect |  | JwtClientAuthGuard | client-sheets-google.controller.ts |
| E205 | client-portal | GET | /client/shipping/geo/boundary |  | JwtClientAuthGuard | client-shipping.controller.ts |
| E206 | client-portal | POST | /client/shipping/address/resolve-from-pin |  | JwtClientAuthGuard | client-shipping.controller.ts |
| E207 | client-portal | POST | /client/shipping/address/resolve-from-names |  | JwtClientAuthGuard | client-shipping.controller.ts |
| E208 | client-portal | POST | /client/shipping/babel/resolve-neighbourhood |  | JwtClientAuthGuard | client-shipping.controller.ts |
| E209 | client-portal | GET | /client/stock/availability |  | JwtClientAuthGuard | client-stock.controller.ts |
| E210 | client-portal | GET | /client/stock/export |  | JwtClientAuthGuard | client-stock.controller.ts |
| E211 | client-portal | GET | /client/stock |  | JwtClientAuthGuard | client-stock.controller.ts |
| E212 | client-portal | GET | /client/webhooks |  | JwtClientAuthGuard | client-webhooks.controller.ts |
| E213 | client-portal | POST | /client/webhooks |  | JwtClientAuthGuard | client-webhooks.controller.ts |
| E214 | client-portal | POST | /client/webhooks/:id/rotate-secret |  | JwtClientAuthGuard | client-webhooks.controller.ts |
| E215 | client-portal | POST | /client/webhooks/:id/test |  | JwtClientAuthGuard | client-webhooks.controller.ts |
| E216 | client-portal | PATCH | /client/webhooks/:id/enabled |  | JwtClientAuthGuard | client-webhooks.controller.ts |
| E217 | client-portal | GET | /client/webhooks/:id/deliveries |  | JwtClientAuthGuard | client-webhooks.controller.ts |
| E218 | client-portal | DELETE | /client/webhooks/:id |  | JwtClientAuthGuard | client-webhooks.controller.ts |
| E219 | cod | GET | /cod/records |  |  | cod.controller.ts |
| E220 | cod | POST | /cod/status-by-scan |  |  | cod.controller.ts |
| E221 | cod | GET | /cod/records/export |  |  | cod.controller.ts |
| E222 | cod | GET | /cod/records/export.pdf |  |  | cod.controller.ts |
| E223 | cod | GET | /cod/records/:id |  |  | cod.controller.ts |
| E224 | cod | GET | /cod/by-order/:omsOrderId |  |  | cod.controller.ts |
| E225 | cod | POST | /cod/orders/:omsOrderId/retry |  |  | cod.controller.ts |
| E226 | cod | PATCH | /cod/records/:id/status |  |  | cod.controller.ts |
| E227 | cod | POST | /cod/records/:id/adjustments |  |  | cod.controller.ts |
| E228 | companies | GET | /companies |  |  | companies.controller.ts |
| E229 | companies | GET | /companies/:id |  |  | companies.controller.ts |
| E230 | companies | GET | /companies/:id/lifecycle |  | InternalAdminGuard | companies.controller.ts |
| E231 | companies | POST | /companies |  | InternalAdminGuard | companies.controller.ts |
| E232 | companies | PATCH | /companies/:id |  | InternalAdminGuard | companies.controller.ts |
| E233 | companies | POST | /companies/:id/logo |  | InternalAdminGuard | companies.controller.ts |
| E234 | companies | DELETE | /companies/:id/logo |  | InternalAdminGuard | companies.controller.ts |
| E235 | companies | POST | /companies/:id/suspend |  | InternalAdminGuard | companies.controller.ts |
| E236 | companies | POST | /companies/:id/archive |  | InternalAdminGuard | companies.controller.ts |
| E237 | companies | POST | /companies/:id/restore |  | InternalAdminGuard | companies.controller.ts |
| E238 | companies | POST | /companies/:id/close |  | InternalAdminGuard | companies.controller.ts |
| E239 | companies | POST | /companies/:id/purge |  | SuperAdminGuard | companies.controller.ts |
| E240 | companies | DELETE | /companies/:id |  | InternalAdminGuard | companies.controller.ts |
| E241 | cycle-count | GET | /cycle-count/execution/tasks |  | RolesGuard | cycle-count-execution.controller.ts |
| E242 | cycle-count | GET | /cycle-count/execution/tasks/:id |  | RolesGuard | cycle-count-execution.controller.ts |
| E243 | cycle-count | POST | /cycle-count/execution/tasks/:id/claim |  | RolesGuard | cycle-count-execution.controller.ts |
| E244 | cycle-count | POST | /cycle-count/execution/tasks/:id/lines/:lineId/count |  | RolesGuard | cycle-count-execution.controller.ts |
| E245 | cycle-count | POST | /cycle-count/execution/tasks/:id/lines/:lineId/skip |  | RolesGuard | cycle-count-execution.controller.ts |
| E246 | cycle-count | POST | /cycle-count/execution/tasks/:id/finish |  | RolesGuard | cycle-count-execution.controller.ts |
| E247 | cycle-count | GET | /cycle-count/variances/reason-codes |  |  | cycle-count-variance.controller.ts |
| E248 | cycle-count | GET | /cycle-count/variances |  |  | cycle-count-variance.controller.ts |
| E249 | cycle-count | GET | /cycle-count/variances/:id |  |  | cycle-count-variance.controller.ts |
| E250 | cycle-count | PATCH | /cycle-count/variances/:id/review |  | InternalAdminGuard | cycle-count-variance.controller.ts |
| E251 | cycle-count | POST | /cycle-count/schedules |  | InternalAdminGuard | cycle-count.controller.ts |
| E252 | cycle-count | GET | /cycle-count/schedules |  | InternalAdminGuard | cycle-count.controller.ts |
| E253 | cycle-count | GET | /cycle-count/product-history |  | InternalAdminGuard | cycle-count.controller.ts |
| E254 | cycle-count | POST | /cycle-count/counts |  | InternalAdminGuard | cycle-count.controller.ts |
| E255 | cycle-count | GET | /cycle-count/counts |  | InternalAdminGuard | cycle-count.controller.ts |
| E256 | cycle-count | GET | /cycle-count/counts/:id |  | InternalAdminGuard | cycle-count.controller.ts |
| E257 | cycle-count | POST | /cycle-count/counts/:id/start |  | InternalAdminGuard | cycle-count.controller.ts |
| E258 | cycle-count | PATCH | /cycle-count/counts/:id/assign |  | InternalAdminGuard | cycle-count.controller.ts |
| E259 | cycle-count | PATCH | /cycle-count/counts/:id/lines/:lineId/assign |  | InternalAdminGuard | cycle-count.controller.ts |
| E260 | cycle-count | POST | /cycle-count/counts/:id/lines/:lineId/count |  | InternalAdminGuard | cycle-count.controller.ts |
| E261 | cycle-count | POST | /cycle-count/counts/:id/lines/:lineId/skip |  | InternalAdminGuard | cycle-count.controller.ts |
| E262 | cycle-count | POST | /cycle-count/counts/:id/submit-review |  | InternalAdminGuard | cycle-count.controller.ts |
| E263 | cycle-count | GET | /cycle-count/counts/:id/variances |  | InternalAdminGuard | cycle-count.controller.ts |
| E264 | cycle-count | GET | /cycle-count/counts/:id/adjustments |  | InternalAdminGuard | cycle-count.controller.ts |
| E265 | cycle-count | POST | /cycle-count/counts/:id/reconcile |  | InternalAdminGuard | cycle-count.controller.ts |
| E266 | cycle-count | POST | /cycle-count/counts/:id/post-reconciliation |  | InternalAdminGuard | cycle-count.controller.ts |
| E267 | cycle-count | POST | /cycle-count/counts/:id/complete |  | InternalAdminGuard | cycle-count.controller.ts |
| E268 | cycle-count | POST | /cycle-count/counts/:id/cancel |  | InternalAdminGuard | cycle-count.controller.ts |
| E269 | dashboard | GET | /dashboard/open-orders-charts |  |  | dashboard.controller.ts |
| E270 | dashboard | GET | /dashboard/overview |  |  | dashboard.controller.ts |
| E271 | final-contracts | GET | /final-contracts |  |  | final-contracts.controller.ts |
| E272 | final-contracts | GET | /final-contracts/:id |  |  | final-contracts.controller.ts |
| E273 | final-contracts | POST | /final-contracts |  |  | final-contracts.controller.ts |
| E274 | final-contracts | PATCH | /final-contracts/:id |  |  | final-contracts.controller.ts |
| E275 | financial | GET | /client/finances/account |  | JwtClientAuthGuard | client-financial.controller.ts |
| E276 | financial | GET | /client/finances/transactions/export |  | JwtClientAuthGuard | client-financial.controller.ts |
| E277 | financial | GET | /client/finances/transactions |  | JwtClientAuthGuard | client-financial.controller.ts |
| E278 | financial | GET | /client/finances/payouts |  | JwtClientAuthGuard | client-financial.controller.ts |
| E279 | financial | POST | /client/finances/payouts/request |  | JwtClientAuthGuard | client-financial.controller.ts |
| E280 | financial | GET | /client/finances/cod |  | JwtClientAuthGuard | client-financial.controller.ts |
| E281 | financial | GET | /finance/overview |  | InternalAdminGuard | financial.controller.ts |
| E282 | financial | POST | /finance/accounts/reconcile |  | InternalAdminGuard | financial.controller.ts |
| E283 | financial | GET | /finance/accounts |  | InternalAdminGuard | financial.controller.ts |
| E284 | financial | GET | /finance/accounts/:companyId |  | InternalAdminGuard | financial.controller.ts |
| E285 | financial | GET | /finance/transactions |  | InternalAdminGuard | financial.controller.ts |
| E286 | financial | GET | /finance/transactions/export |  | InternalAdminGuard | financial.controller.ts |
| E287 | financial | POST | /finance/transactions/adjustment |  | InternalAdminGuard | financial.controller.ts |
| E288 | financial | GET | /finance/cod |  | InternalAdminGuard | financial.controller.ts |
| E289 | financial | POST | /finance/cod/:id/confirm-collection |  | InternalAdminGuard | financial.controller.ts |
| E290 | financial | POST | /finance/cod/:id/confirm-remittance |  | InternalAdminGuard | financial.controller.ts |
| E291 | financial | GET | /finance/payouts |  | InternalAdminGuard | financial.controller.ts |
| E292 | financial | PATCH | /finance/payouts/:id/review |  | InternalAdminGuard | financial.controller.ts |
| E293 | financial | POST | /finance/payouts/:id/record-paid |  | InternalAdminGuard | financial.controller.ts |
| E294 | financial | GET | /finance/policies |  | InternalAdminGuard | financial.controller.ts |
| E295 | financial | PUT | /finance/policies/:key |  | InternalAdminGuard | financial.controller.ts |
| E296 | financial | GET | /finance/carrier-costs |  | InternalAdminGuard | financial.controller.ts |
| E297 | financial | POST | /finance/carrier-costs/:id/mark-paid |  | InternalAdminGuard | financial.controller.ts |
| E298 | financial | GET | /finance/float/in-transit |  | InternalAdminGuard | financial.controller.ts |
| E299 | financial | POST | /finance/float/reconcile |  | InternalAdminGuard | financial.controller.ts |
| E300 | forms | POST | /forms/submit | public |  | forms.controller.ts |
| E301 | forms | GET | /forms |  | InternalAdminGuard | forms.controller.ts |
| E302 | forms | GET | /forms/activity-types |  | InternalAdminGuard | forms.controller.ts |
| E303 | forms | GET | /forms/:id |  | InternalAdminGuard | forms.controller.ts |
| E304 | forms | DELETE | /forms/:id |  | SuperAdminGuard | forms.controller.ts |
| E305 | inbound | POST | /inbound-orders |  |  | inbound.controller.ts |
| E306 | inbound | GET | /inbound-orders |  |  | inbound.controller.ts |
| E307 | inbound | GET | /inbound-orders/export |  |  | inbound.controller.ts |
| E308 | inbound | GET | /inbound-orders/export/columns |  |  | inbound.controller.ts |
| E309 | inbound | POST | /inbound-orders/export |  |  | inbound.controller.ts |
| E310 | inbound | GET | /inbound-orders/import/template |  |  | inbound.controller.ts |
| E311 | inbound | POST | /inbound-orders/import/validate |  |  | inbound.controller.ts |
| E312 | inbound | POST | /inbound-orders/import |  |  | inbound.controller.ts |
| E313 | inbound | GET | /inbound-orders/:id |  |  | inbound.controller.ts |
| E314 | inbound | PATCH | /inbound-orders/:id/plan |  |  | inbound.controller.ts |
| E315 | inbound | POST | /inbound-orders/:id/approve |  |  | inbound.controller.ts |
| E316 | inbound | POST | /inbound-orders/:id/complete-receiving |  |  | inbound.controller.ts |
| E317 | inbound | POST | /inbound-orders/:id/complete-putaway |  |  | inbound.controller.ts |
| E318 | inbound | POST | /inbound-orders/:id/execute-admin |  |  | inbound.controller.ts |
| E319 | inbound | POST | /inbound-orders/:id/confirm |  |  | inbound.controller.ts |
| E320 | inbound | POST | /inbound-orders/:id/cancel |  |  | inbound.controller.ts |
| E321 | inbound | DELETE | /inbound-orders/:id |  | InternalAdminGuard | inbound.controller.ts |
| E322 | inbound | POST | /inbound-orders/:id/lines/:lineId/receive |  |  | inbound.controller.ts |
| E323 | inventory | GET | /inventory/stock/by-product |  |  | inventory.controller.ts |
| E324 | inventory | GET | /inventory/stock/by-product/export |  |  | inventory.controller.ts |
| E325 | inventory | GET | /inventory/stock/balance-history |  |  | inventory.controller.ts |
| E326 | inventory | GET | /inventory/stock |  |  | inventory.controller.ts |
| E327 | inventory | GET | /inventory/ledger/entry |  |  | inventory.controller.ts |
| E328 | inventory | GET | /inventory/ledger/export |  |  | inventory.controller.ts |
| E329 | inventory | GET | /inventory/ledger |  |  | inventory.controller.ts |
| E330 | inventory | GET | /inventory/availability |  |  | inventory.controller.ts |
| E331 | inventory | GET | /inventory/consistency/validate | AuthGroup.ADMIN | RolesGuard | inventory.controller.ts |
| E332 | inventory | POST | /inventory/internal-transfer |  | InternalAdminGuard | inventory.controller.ts |
| E333 | locations | POST | /locations |  | InternalAdminGuard | locations.controller.ts |
| E334 | locations | GET | /locations |  | InternalAdminGuard | locations.controller.ts |
| E335 | locations | GET | /locations/lookup |  | InternalAdminGuard | locations.controller.ts |
| E336 | locations | GET | /locations/purge-context |  | InternalAdminGuard | locations.controller.ts |
| E337 | locations | PATCH | /locations/:id |  | InternalAdminGuard | locations.controller.ts |
| E338 | locations | DELETE | /locations/:id/permanent |  | InternalAdminGuard | locations.controller.ts |
| E339 | locations | DELETE | /locations/:id |  | InternalAdminGuard | locations.controller.ts |
| E340 | locations | GET | /locations/:id |  | InternalAdminGuard | locations.controller.ts |
| E341 | notifications | GET | /notifications |  |  | notifications.controller.ts |
| E342 | notifications | PATCH | /notifications/:id/read |  |  | notifications.controller.ts |
| E343 | notifications | POST | /notifications/read-all |  |  | notifications.controller.ts |
| E344 | observability | GET | /ops/health/live | public | OpsProbeGuard | observability.controller.ts |
| E345 | observability | GET | /ops/health/ready | public | OpsProbeGuard | observability.controller.ts |
| E346 | observability | GET | /ops/diagnostics |  | InternalAdminGuard | observability.controller.ts |
| E347 | observability | GET | /ops/policy |  | InternalAdminGuard | observability.controller.ts |
| E348 | oms-returns | GET | /oms/returns |  |  | oms-returns.controller.ts |
| E349 | oms-returns | GET | /oms/returns/export |  |  | oms-returns.controller.ts |
| E350 | oms-returns | POST | /oms/returns |  |  | oms-returns.controller.ts |
| E351 | oms-returns | POST | /oms/returns/express |  |  | oms-returns.controller.ts |
| E352 | oms-returns | POST | /oms/returns/express/validate |  |  | oms-returns.controller.ts |
| E353 | oms-returns | POST | /oms/returns/preview |  |  | oms-returns.controller.ts |
| E354 | oms-returns | POST | /oms/returns/import/validate |  |  | oms-returns.controller.ts |
| E355 | oms-returns | POST | /oms/returns/import |  |  | oms-returns.controller.ts |
| E356 | oms-returns | GET | /oms/returns/:id |  |  | oms-returns.controller.ts |
| E357 | oms-returns | PATCH | /oms/returns/:id/plan |  |  | oms-returns.controller.ts |
| E358 | oms-returns | POST | /oms/returns/:id/approve |  |  | oms-returns.controller.ts |
| E359 | oms-returns | POST | /oms/returns/:id/complete-receiving |  |  | oms-returns.controller.ts |
| E360 | oms-returns | POST | /oms/returns/:id/complete-putaway |  |  | oms-returns.controller.ts |
| E361 | oms-returns | POST | /oms/returns/:id/reject |  |  | oms-returns.controller.ts |
| E362 | oms-returns | POST | /oms/returns/:id/confirm |  |  | oms-returns.controller.ts |
| E363 | oms-returns | POST | /oms/returns/confirm-bulk |  |  | oms-returns.controller.ts |
| E364 | oms-returns | POST | /oms/returns/confirm-by-scan |  |  | oms-returns.controller.ts |
| E365 | oms-returns | POST | /oms/returns/:id/rollback |  |  | oms-returns.controller.ts |
| E366 | oms | POST | /oms/batches |  |  | oms-batch.controller.ts |
| E367 | oms | GET | /oms/batches |  |  | oms-batch.controller.ts |
| E368 | oms | GET | /oms/batches/:id/instructions/pdf |  |  | oms-batch.controller.ts |
| E369 | oms | POST | /oms/batches/:id/labels/pdf |  |  | oms-batch.controller.ts |
| E370 | oms | GET | /oms/batches/:id |  |  | oms-batch.controller.ts |
| E371 | oms | POST | /oms/batches/:id/orders |  |  | oms-batch.controller.ts |
| E372 | oms | POST | /oms/batches/:id/remove-orders |  |  | oms-batch.controller.ts |
| E373 | oms | POST | /oms/batches/:id/flag-orders |  |  | oms-batch.controller.ts |
| E374 | oms | POST | /oms/batches/:id/clear-flags |  |  | oms-batch.controller.ts |
| E375 | oms | POST | /oms/batches/:id/cancel-shipments |  |  | oms-batch.controller.ts |
| E376 | oms | GET | /oms/dashboard |  |  | oms.controller.ts |
| E377 | oms | GET | /oms/dashboard/order-summary |  |  | oms.controller.ts |
| E378 | oms | GET | /oms/orders |  |  | oms.controller.ts |
| E379 | oms | GET | /oms/orders/nav-counts |  |  | oms.controller.ts |
| E380 | oms | GET | /oms/orders/export |  |  | oms.controller.ts |
| E381 | oms | GET | /oms/orders/export/columns |  |  | oms.controller.ts |
| E382 | oms | POST | /oms/orders/export |  |  | oms.controller.ts |
| E383 | oms | GET | /oms/orders/import/template |  |  | oms.controller.ts |
| E384 | oms | POST | /oms/orders/import/validate |  |  | oms.controller.ts |
| E385 | oms | POST | /oms/orders/import |  |  | oms.controller.ts |
| E386 | oms | POST | /oms/orders |  |  | oms.controller.ts |
| E387 | oms | POST | /oms/orders/scan-shipping-transition |  |  | oms.controller.ts |
| E388 | oms | POST | /oms/orders/approve-bulk |  |  | oms.controller.ts |
| E389 | oms | POST | /oms/orders/confirm-bulk |  |  | oms.controller.ts |
| E390 | oms | POST | /oms/orders/cancel-bulk |  |  | oms.controller.ts |
| E391 | oms | POST | /oms/orders/cancel-shipments-bulk |  |  | oms.controller.ts |
| E392 | oms | POST | /oms/orders/delivered-bulk |  |  | oms.controller.ts |
| E393 | oms | POST | /oms/orders/failed-delivery-bulk |  |  | oms.controller.ts |
| E394 | oms | POST | /oms/orders/returned-bulk |  |  | oms.controller.ts |
| E395 | oms | POST | /oms/orders/adjust-shipping-fee-bulk |  | InternalAdminGuard | oms.controller.ts |
| E396 | oms | POST | /oms/orders/waybills/export-excel |  |  | oms.controller.ts |
| E397 | oms | POST | /oms/orders/waybills/pdf |  |  | oms.controller.ts |
| E398 | oms | POST | /oms/orders/instructions/pdf |  |  | oms.controller.ts |
| E399 | oms | POST | /oms/orders/instructions/zip |  |  | oms.controller.ts |
| E400 | oms | GET | /oms/orders/:id |  |  | oms.controller.ts |
| E401 | oms | GET | /oms/orders/:id/traceability |  |  | oms.controller.ts |
| E402 | oms | PATCH | /oms/orders/:id |  |  | oms.controller.ts |
| E403 | oms | DELETE | /oms/orders/:id |  |  | oms.controller.ts |
| E404 | oms | POST | /oms/orders/:id/confirm |  |  | oms.controller.ts |
| E405 | oms | POST | /oms/orders/:id/approve |  |  | oms.controller.ts |
| E406 | oms | POST | /oms/orders/:id/adjust-shipping-fee |  | InternalAdminGuard | oms.controller.ts |
| E407 | oms | POST | /oms/orders/:id/adjust-carrier-cost |  | InternalAdminGuard | oms.controller.ts |
| E408 | oms | POST | /oms/orders/:id/reject |  |  | oms.controller.ts |
| E409 | oms | POST | /oms/orders/:id/cancel |  |  | oms.controller.ts |
| E410 | oms | POST | /oms/orders/:id/cancel-shipment |  |  | oms.controller.ts |
| E411 | oms | POST | /oms/orders/:id/cancel-revert |  |  | oms.controller.ts |
| E412 | oms | POST | /oms/orders/:id/failed-delivery |  |  | oms.controller.ts |
| E413 | oms | POST | /oms/orders/:id/complete |  |  | oms.controller.ts |
| E414 | oms | POST | /oms/orders/:id/allocate |  |  | oms.controller.ts |
| E415 | oms | POST | /oms/orders/:id/release-allocation |  |  | oms.controller.ts |
| E416 | oms | POST | /oms/orders/:id/out-for-delivery |  |  | oms.controller.ts |
| E417 | oms | POST | /oms/orders/:id/external-fulfillment |  |  | oms.controller.ts |
| E418 | oms | POST | /oms/orders/:id/delivered |  |  | oms.controller.ts |
| E419 | oms | POST | /oms/orders/:id/delivery-revert |  |  | oms.controller.ts |
| E420 | oms | POST | /oms/orders/:id/confirm-return-receipt |  |  | oms.controller.ts |
| E421 | oms | POST | /oms/orders/:id/undo-confirmed-return |  |  | oms.controller.ts |
| E422 | oms | POST | /oms/orders/:id/rollback-return |  |  | oms.controller.ts |
| E423 | oms | POST | /oms/orders/:id/returned |  |  | oms.controller.ts |
| E424 | oms | POST | /oms/orders/:id/cod/collect |  |  | oms.controller.ts |
| E425 | oms | POST | /oms/orders/:id/cod/settle |  |  | oms.controller.ts |
| E426 | oms | GET | /oms/orders/:id/timeline |  |  | oms.controller.ts |
| E427 | oms | GET | /oms/orders/:id/shipping-movement |  |  | oms.controller.ts |
| E428 | oms | GET | /oms/orders/:id/instructions/pdf |  |  | oms.controller.ts |
| E429 | oms | GET | /oms/orders/:id/waybill |  |  | oms.controller.ts |
| E430 | oms | GET | /oms/orders/:id/waybill/pdf |  |  | oms.controller.ts |
| E431 | oms | GET | /oms/sales-channels |  |  | oms-webhooks.controller.ts |
| E432 | oms | POST | /oms/sales-channels |  |  | oms-webhooks.controller.ts |
| E433 | oms | POST | /oms/webhooks/inbound/:channelId | public |  | oms-webhooks.controller.ts |
| E434 | outbound | POST | /outbound-orders |  |  | outbound.controller.ts |
| E435 | outbound | POST | /outbound-orders/quick-directed |  |  | outbound.controller.ts |
| E436 | outbound | GET | /outbound-orders |  |  | outbound.controller.ts |
| E437 | outbound | GET | /outbound-orders/export |  |  | outbound.controller.ts |
| E438 | outbound | GET | /outbound-orders/export/columns |  |  | outbound.controller.ts |
| E439 | outbound | POST | /outbound-orders/export |  |  | outbound.controller.ts |
| E440 | outbound | GET | /outbound-orders/import/template |  |  | outbound.controller.ts |
| E441 | outbound | POST | /outbound-orders/import/validate |  |  | outbound.controller.ts |
| E442 | outbound | POST | /outbound-orders/import |  |  | outbound.controller.ts |
| E443 | outbound | POST | /outbound-orders/bulk/process |  |  | outbound.controller.ts |
| E444 | outbound | POST | /outbound-orders/bulk/complete-picking |  |  | outbound.controller.ts |
| E445 | outbound | POST | /outbound-orders/bulk/complete-packing |  |  | outbound.controller.ts |
| E446 | outbound | POST | /outbound-orders/bulk/complete-dispatch |  |  | outbound.controller.ts |
| E447 | outbound | POST | /outbound-orders/bulk/complete-shipping-details |  |  | outbound.controller.ts |
| E448 | outbound | POST | /outbound-orders/bulk/shipping-details/preview |  |  | outbound.controller.ts |
| E449 | outbound | POST | /outbound-orders/bulk/shipping-details |  |  | outbound.controller.ts |
| E450 | outbound | GET | /outbound-orders/:id |  |  | outbound.controller.ts |
| E451 | outbound | PATCH | /outbound-orders/:id/plan |  |  | outbound.controller.ts |
| E452 | outbound | POST | /outbound-orders/:id/approve |  |  | outbound.controller.ts |
| E453 | outbound | POST | /outbound-orders/:id/complete-picking |  |  | outbound.controller.ts |
| E454 | outbound | POST | /outbound-orders/:id/complete-packing |  |  | outbound.controller.ts |
| E455 | outbound | POST | /outbound-orders/:id/select-shipping-method |  |  | outbound.controller.ts |
| E456 | outbound | PATCH | /outbound-orders/:id/shipping-details |  |  | outbound.controller.ts |
| E457 | outbound | POST | /outbound-orders/:id/shipping-details/send |  |  | outbound.controller.ts |
| E458 | outbound | POST | /outbound-orders/:id/complete-shipping-details |  |  | outbound.controller.ts |
| E459 | outbound | POST | /outbound-orders/:id/complete-dispatch |  |  | outbound.controller.ts |
| E460 | outbound | POST | /outbound-orders/:id/execute-admin |  |  | outbound.controller.ts |
| E461 | outbound | POST | /outbound-orders/:id/confirm |  |  | outbound.controller.ts |
| E462 | outbound | POST | /outbound-orders/:id/cancel |  |  | outbound.controller.ts |
| E463 | outbound | DELETE | /outbound-orders/:id |  | InternalAdminGuard | outbound.controller.ts |
| E464 | products | POST | /products |  | InternalAdminGuard | products.controller.ts |
| E465 | products | GET | /products |  | InternalAdminGuard | products.controller.ts |
| E466 | products | GET | /products/export |  | InternalAdminGuard | products.controller.ts |
| E467 | products | GET | /products/next-sku |  | InternalAdminGuard | products.controller.ts |
| E468 | products | POST | /products/:id/suspend |  | InternalAdminGuard | products.controller.ts |
| E469 | products | POST | /products/:id/unsuspend |  | InternalAdminGuard | products.controller.ts |
| E470 | products | DELETE | /products/:id/hard |  | InternalAdminGuard | products.controller.ts |
| E471 | products | GET | /products/:id/lots |  | InternalAdminGuard | products.controller.ts |
| E472 | products | PATCH | /products/:id |  | InternalAdminGuard | products.controller.ts |
| E473 | products | DELETE | /products/:id |  | InternalAdminGuard | products.controller.ts |
| E474 | products | GET | /products/:id |  | InternalAdminGuard | products.controller.ts |
| E475 | realtime | GET | /realtime/version |  | JwtAuthGuard | realtime-version.controller.ts |
| E476 | realtime | GET | /realtime/presence/online |  | JwtAuthGuard | realtime-version.controller.ts |
| E477 | reports | GET | /reports/policy |  | RolesGuard | reports.controller.ts |
| E478 | reports | GET | /reports/:reportId/kpis |  | RolesGuard | reports.controller.ts |
| E479 | reports | GET | /reports/:reportId/aggregate |  | RolesGuard | reports.controller.ts |
| E480 | reports | GET | /reports/:reportId/export |  | RolesGuard | reports.controller.ts |
| E481 | reports | GET | /reports/:reportId/run |  | RolesGuard | reports.controller.ts |
| E482 | returns | POST | /return-orders |  |  | returns.controller.ts |
| E483 | returns | GET | /return-orders |  |  | returns.controller.ts |
| E484 | returns | GET | /return-orders/outbound-quota/:outboundId |  |  | returns.controller.ts |
| E485 | returns | GET | /return-orders/:id |  |  | returns.controller.ts |
| E486 | returns | POST | /return-orders/:id/confirm |  |  | returns.controller.ts |
| E487 | returns | POST | /return-orders/:id/start-receiving |  |  | returns.controller.ts |
| E488 | returns | POST | /return-orders/:id/complete |  |  | returns.controller.ts |
| E489 | returns | POST | /return-orders/:id/cancel |  |  | returns.controller.ts |
| E490 | returns | POST | /return-orders/:id/lines/:lineId/receive |  |  | returns.controller.ts |
| E491 | returns | POST | /return-orders/:id/lines/:lineId/inspect |  |  | returns.controller.ts |
| E492 | returns | POST | /return-orders/:id/lines/:lineId/apply-disposition |  |  | returns.controller.ts |
| E493 | returns | POST | /return-orders/:id/post-inventory |  |  | returns.controller.ts |
| E494 | settings | GET | /settings/google-oauth |  | SuperAdminGuard | settings.controller.ts |
| E495 | settings | PUT | /settings/google-oauth |  | SuperAdminGuard | settings.controller.ts |
| E496 | settings | POST | /settings/google-oauth/test |  | SuperAdminGuard | settings.controller.ts |
| E497 | shipping | GET | /shipping/fee-rates |  | RolesGuard, SuperAdminGuard | shipping-fee.controller.ts |
| E498 | shipping | GET | /shipping/fee-rates/locations |  | RolesGuard, SuperAdminGuard | shipping-fee.controller.ts |
| E499 | shipping | PUT | /shipping/fee-rates/settings |  | RolesGuard, SuperAdminGuard | shipping-fee.controller.ts |
| E500 | shipping | POST | /shipping/fee-rates/groups |  | RolesGuard, SuperAdminGuard | shipping-fee.controller.ts |
| E501 | shipping | PUT | /shipping/fee-rates/groups/:id |  | RolesGuard, SuperAdminGuard | shipping-fee.controller.ts |
| E502 | shipping | PATCH | /shipping/fee-rates/groups/:id/active |  | RolesGuard, SuperAdminGuard | shipping-fee.controller.ts |
| E503 | shipping | POST | /shipping/fee-rates/preview |  | RolesGuard, SuperAdminGuard | shipping-fee.controller.ts |
| E504 | shipping | POST | /shipping/webhooks/:providerCode | public |  | shipping-webhook.controller.ts |
| E505 | shipping | GET | /shipping/orders/:omsOrderId/carrier-costs |  | RolesGuard, InternalAdminGuard | shipping.controller.ts |
| E506 | shipping | GET | /shipping/providers |  | RolesGuard, InternalAdminGuard | shipping.controller.ts |
| E507 | shipping | GET | /shipping/fx |  | RolesGuard, InternalAdminGuard | shipping.controller.ts |
| E508 | shipping | PUT | /shipping/fx |  | RolesGuard, InternalAdminGuard | shipping.controller.ts |
| E509 | shipping | POST | /shipping/fx/test-source |  | RolesGuard, InternalAdminGuard | shipping.controller.ts |
| E510 | shipping | GET | /shipping/origin-address |  | RolesGuard, InternalAdminGuard | shipping.controller.ts |
| E511 | shipping | PUT | /shipping/origin-address |  | RolesGuard, InternalAdminGuard | shipping.controller.ts |
| E512 | shipping | POST | /shipping/providers/:code/connect |  | RolesGuard, InternalAdminGuard | shipping.controller.ts |
| E513 | shipping | POST | /shipping/providers/:code/test |  | RolesGuard, InternalAdminGuard | shipping.controller.ts |
| E514 | shipping | POST | /shipping/providers/:code/disconnect |  | RolesGuard, InternalAdminGuard | shipping.controller.ts |
| E515 | shipping | GET | /shipping/geo/boundary |  | RolesGuard, InternalAdminGuard | shipping.controller.ts |
| E516 | shipping | POST | /shipping/babel/geo/sync |  | RolesGuard, InternalAdminGuard | shipping.controller.ts |
| E517 | shipping | GET | /shipping/babel/geo/meta |  | RolesGuard, InternalAdminGuard | shipping.controller.ts |
| E518 | shipping | GET | /shipping/babel/geo/cities |  | RolesGuard, InternalAdminGuard | shipping.controller.ts |
| E519 | shipping | GET | /shipping/babel/geo/cities/:cityId/areas |  | RolesGuard, InternalAdminGuard | shipping.controller.ts |
| E520 | shipping | GET | /shipping/babel/geo/areas/:areaId/neighbourhoods |  | RolesGuard, InternalAdminGuard | shipping.controller.ts |
| E521 | shipping | POST | /shipping/address/resolve-from-pin |  | RolesGuard, InternalAdminGuard | shipping.controller.ts |
| E522 | shipping | POST | /shipping/address/resolve-from-names |  | RolesGuard, InternalAdminGuard | shipping.controller.ts |
| E523 | shipping | POST | /shipping/babel/resolve-neighbourhood |  | RolesGuard, InternalAdminGuard | shipping.controller.ts |
| E524 | shipping | POST | /shipping/rates |  | RolesGuard, InternalAdminGuard | shipping.controller.ts |
| E525 | shipping | POST | /shipping/shipments/:outboundOrderId/retry |  | RolesGuard, InternalAdminGuard | shipping.controller.ts |
| E526 | shipping | POST | /shipping/shipments/:outboundOrderId/sync-tracking |  | RolesGuard, InternalAdminGuard | shipping.controller.ts |
| E527 | shipping | POST | /shipping/providers/:providerCode/register-webhook |  | RolesGuard, InternalAdminGuard | shipping.controller.ts |
| E528 | shipping | POST | /shipping/shipments/:outboundOrderId/refresh-sila-awb |  | RolesGuard, InternalAdminGuard | shipping.controller.ts |
| E529 | shipping | GET | /shipping/bulk/eligible |  | RolesGuard, InternalAdminGuard | shipping.controller.ts |
| E530 | shipping | POST | /shipping/bulk/preview |  | RolesGuard, InternalAdminGuard | shipping.controller.ts |
| E531 | shipping | POST | /shipping/bulk/jobs |  | RolesGuard, InternalAdminGuard | shipping.controller.ts |
| E532 | shipping | GET | /shipping/bulk/jobs/:id |  | RolesGuard, InternalAdminGuard | shipping.controller.ts |
| E533 | shipping | POST | /shipping/bulk/jobs/:id/items/:outboundOrderId/retry |  | RolesGuard, InternalAdminGuard | shipping.controller.ts |
| E534 | shipping | GET | /shipping/bulk/jobs/:id/labels |  | RolesGuard, InternalAdminGuard | shipping.controller.ts |
| E535 | users | GET | /users |  | InternalAdminGuard | users.controller.ts |
| E536 | users | GET | /users/custom-roles |  | InternalAdminGuard | users.controller.ts |
| E537 | users | POST | /users/custom-roles |  | InternalAdminGuard | users.controller.ts |
| E538 | users | PATCH | /users/custom-roles/:roleId |  | InternalAdminGuard | users.controller.ts |
| E539 | users | DELETE | /users/custom-roles/:roleId |  | InternalAdminGuard | users.controller.ts |
| E540 | users | GET | /users/:id/worker-profile |  | InternalAdminGuard | users.controller.ts |
| E541 | users | PUT | /users/:id/worker-profile |  | InternalAdminGuard | users.controller.ts |
| E542 | users | GET | /users/:id |  | InternalAdminGuard | users.controller.ts |
| E543 | users | POST | /users |  | InternalAdminGuard | users.controller.ts |
| E544 | users | PATCH | /users/:id |  | InternalAdminGuard | users.controller.ts |
| E545 | users | POST | /users/:id/suspend |  | InternalAdminGuard | users.controller.ts |
| E546 | users | DELETE | /users/:id |  | InternalAdminGuard | users.controller.ts |
| E547 | warehouse-workflow | GET | /analytics/overview |  |  | analytics-overview.controller.ts |
| E548 | warehouse-workflow | GET | /tasks |  |  | warehouse-tasks.controller.ts |
| E549 | warehouse-workflow | GET | /tasks/:id/path-order |  |  | warehouse-tasks.controller.ts |
| E550 | warehouse-workflow | PUT | /tasks/:id/progress |  | WorkflowExecutionGateGuard | warehouse-tasks.controller.ts |
| E551 | warehouse-workflow | PUT | /tasks/:id/plan |  | WorkflowExecutionGateGuard | warehouse-tasks.controller.ts |
| E552 | warehouse-workflow | POST | /tasks/:id/lease |  | WorkflowExecutionGateGuard | warehouse-tasks.controller.ts |
| E553 | warehouse-workflow | POST | /tasks/:id/lease/release |  |  | warehouse-tasks.controller.ts |
| E554 | warehouse-workflow | GET | /tasks/:id |  |  | warehouse-tasks.controller.ts |
| E555 | warehouse-workflow | POST | /tasks/:id/assign | AuthGroup.ADMIN | RolesGuard | warehouse-tasks.controller.ts |
| E556 | warehouse-workflow | POST | /tasks/:id/unassign | AuthGroup.ADMIN | RolesGuard | warehouse-tasks.controller.ts |
| E557 | warehouse-workflow | POST | /tasks/:id/start |  | WorkflowExecutionGateGuard | warehouse-tasks.controller.ts |
| E558 | warehouse-workflow | POST | /tasks/:id/complete |  | WorkflowExecutionGateGuard | warehouse-tasks.controller.ts |
| E559 | warehouse-workflow | POST | /tasks/:id/admin-confirm | AuthGroup.ADMIN | RolesGuard | warehouse-tasks.controller.ts |
| E560 | warehouse-workflow | POST | /tasks/:id/cancel | AuthGroup.ADMIN | RolesGuard | warehouse-tasks.controller.ts |
| E561 | warehouse-workflow | POST | /tasks/:id/skip | AuthGroup.ADMIN | RolesGuard | warehouse-tasks.controller.ts |
| E562 | warehouse-workflow | POST | /tasks/:id/retry | AuthGroup.ADMIN | RolesGuard | warehouse-tasks.controller.ts |
| E563 | warehouse-workflow | POST | /tasks/:id/resolve | AuthGroup.ADMIN | RolesGuard | warehouse-tasks.controller.ts |
| E564 | warehouse-workflow | POST | /tasks/:id/fail | AuthGroup.ADMIN | RolesGuard | warehouse-tasks.controller.ts |
| E565 | warehouse-workflow | POST | /tasks/:id/reopen | AuthGroup.ADMIN | RolesGuard | warehouse-tasks.controller.ts |
| E566 | warehouse-workflow | GET | /workers |  |  | workflow-workers.controller.ts |
| E567 | warehouse-workflow | GET | /workers/load |  |  | workflow-workers.controller.ts |
| E568 | warehouse-workflow | GET | /workers/unlinked |  | InternalAdminGuard | workflow-workers.controller.ts |
| E569 | warehouse-workflow | POST | /workers |  | InternalAdminGuard | workflow-workers.controller.ts |
| E570 | warehouse-workflow | GET | /workers/:id |  |  | workflow-workers.controller.ts |
| E571 | warehouse-workflow | GET | /workflows/context-settings |  |  | workflow.controller.ts |
| E572 | warehouse-workflow | GET | /workflows/instances/by-reference |  |  | workflow.controller.ts |
| E573 | warehouse-workflow | GET | /workflows/instances/:instanceId/graph |  |  | workflow.controller.ts |
| E574 | warehouse-workflow | GET | /workflows/references/:referenceType/:referenceId |  |  | workflow.controller.ts |
| E575 | warehouse-workflow | POST | /workflows/inbound/:orderId/start |  |  | workflow.controller.ts |
| E576 | warehouse-workflow | POST | /workflows/outbound/:orderId/start |  |  | workflow.controller.ts |
| E577 | warehouse-workflow | POST | /workflows/instances/:instanceId/recover |  | InternalAdminGuard | workflow.controller.ts |
| E578 | warehouses | POST | /warehouses |  | InternalAdminGuard | warehouses.controller.ts |
| E579 | warehouses | GET | /warehouses |  | InternalAdminGuard | warehouses.controller.ts |
| E580 | warehouses | GET | /warehouses/next-code |  | InternalAdminGuard | warehouses.controller.ts |
| E581 | warehouses | PATCH | /warehouses/:id |  | InternalAdminGuard | warehouses.controller.ts |
| E582 | warehouses | DELETE | /warehouses/:id |  | InternalAdminGuard | warehouses.controller.ts |
| E583 | warehouses | GET | /warehouses/:id |  | InternalAdminGuard | warehouses.controller.ts |
| E584 | warehouses | PATCH | /warehouses/:id/status |  | InternalAdminGuard | warehouses.controller.ts |
| E585 | pdf | GET | /documents/catalog |  |  | documents.controller.ts |
| E586 | pdf | GET | /documents |  |  | documents.controller.ts |
| E587 | pdf | GET | /documents/slot/:taskId |  |  | documents.controller.ts |
| E588 | pdf | PATCH | /documents/slot/:taskId |  |  | documents.controller.ts |
| E589 | pdf | POST | /documents/:id/link |  |  | documents.controller.ts |
| E590 | pdf | GET | /documents/public/:id/:filename | public |  | documents.controller.ts |
| E591 | pdf | GET | /documents/:id/file |  |  | documents.controller.ts |
| E592 | pdf | POST | /documents/grn/:taskId |  |  | documents.controller.ts |
| E593 | pdf | POST | /documents/dn/:taskId |  |  | documents.controller.ts |
| E594 | pdf | POST | /documents/final-contract/:contractId |  |  | documents.controller.ts |
