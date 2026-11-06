---
type: community
cohesion: 0.03
members: 107
---

# AuditLogService

**Cohesion:** 0.03 - loosely connected
**Members:** 107 nodes

## Members
- [[dot-constructor()_98]] - code - backend/src/common/audit/audit-log.service.ts
- [[dot-constructor()_99]] - code - backend/src/common/security/login-brute-force.service.ts
- [[dot-constructor()_100]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[dot-constructor()_101]] - code - backend/src/modules/auth/google-oauth.service.ts
- [[dot-constructor()_102]] - code - backend/src/modules/auth/refresh-session.service.ts
- [[dot-constructor()_103]] - code - backend/src/modules/billing/billing-audit.service.ts
- [[dot-constructor()_104]] - code - backend/src/modules/billing/billing-invoice-calculation.service.ts
- [[dot-constructor()_105]] - code - backend/src/modules/companies/customer-lifecycle.service.ts
- [[dot-constructor()_106]] - code - backend/src/modules/returns/returns.service.ts
- [[dot-constructor()_107]] - code - backend/src/modules/shipping/shipping-fx.service.ts
- [[dot-constructor()_108]] - code - backend/src/modules/warehouses/warehouses.service.ts
- [[dot-failureCount()]] - code - backend/src/common/security/login-brute-force.service.ts
- [[dot-lockSessionRow()]] - code - backend/src/modules/auth/refresh-session.service.ts
- [[dot-nextSku()_1]] - code - backend/src/modules/products/products.service.ts
- [[dot-reset()]] - code - backend/src/common/security/login-brute-force.service.ts
- [[dot-revokeAllSessionsForUser()]] - code - backend/src/modules/auth/refresh-session.service.ts
- [[dot-revokeAllSessionsForUserTx()]] - code - backend/src/modules/auth/refresh-session.service.ts
- [[dot-rotateSession()]] - code - backend/src/modules/auth/refresh-session.service.ts
- [[dot-scheduleAuditEmit()]] - code - backend/src/common/audit/audit-log.service.ts
- [[AuditArchivalCandidate]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[AuditArchivalReport]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[AuditLogDetail_1]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[AuditLogDetailRow]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[AuditLogExportResult]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[AuditLogInput]] - code - backend/src/common/audit/audit-log.service.ts
- [[AuditLogInsertRow]] - code - backend/src/common/audit/audit-log.service.ts
- [[AuditLogListResult_1]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[AuditLogRow]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[AuditLogService]] - code - backend/src/common/audit/audit-log.service.ts
- [[AuditLogSummary_1]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[AuditRow]] - code - backend/src/integration-tests/audit-mutations.integration.ts
- [[CLIENT_ROLES_1]] - code - backend/src/modules/auth/google-oauth.service.ts
- [[CustomerLifecycleContext_1]] - code - backend/src/modules/companies/customer-lifecycle.service.ts
- [[CustomerLifecycleCounts_1]] - code - backend/src/modules/companies/customer-lifecycle.service.ts
- [[GoogleIdentity]] - code - backend/src/modules/auth/google-oauth.service.ts
- [[GoogleOAuthPurpose]] - code - backend/src/modules/auth/google-oauth.service.ts
- [[GoogleOAuthState]] - code - backend/src/modules/auth/google-oauth.service.ts
- [[INBOUND_OPEN_STATUSES]] - code - backend/src/modules/companies/customer-lifecycle.service.ts
- [[INTERNAL_ROLES]] - code - backend/src/modules/products/products.service.ts
- [[Inject_2]] - code
- [[Injectable_68]] - code
- [[Injectable_69]] - code
- [[Injectable_70]] - code
- [[LoginBruteForceService]] - code - backend/src/common/security/login-brute-force.service.ts
- [[OPENID_SCOPES]] - code - backend/src/modules/auth/google-oauth.service.ts
- [[OUTBOUND_OPEN_STATUSES]] - code - backend/src/modules/companies/customer-lifecycle.service.ts
- [[Optional]] - code
- [[ProductAuditSnapshot]] - code - backend/src/modules/products/product-audit.util.ts
- [[ProductRow]] - code - backend/src/modules/realtime/realtime-master-data.payload.ts
- [[QueryContext]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[RETURN_OPEN_STATUSES]] - code - backend/src/modules/companies/customer-lifecycle.service.ts
- [[RefreshSessionService]] - code - backend/src/modules/auth/refresh-session.service.ts
- [[SortColumn]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[TestCase]] - code - backend/src/integration-tests/products-barcode.integration.ts
- [[TxOrPrisma]] - code - backend/src/common/audit/audit-log.service.ts
- [[UNRESOLVED_INVOICE_STATUSES]] - code - backend/src/modules/companies/customer-lifecycle.service.ts
- [[audit-log-redaction.util.ts]] - code - backend/src/common/audit/audit-log-redaction.util.ts
- [[audit-log.service.ts]] - code - backend/src/common/audit/audit-log.service.ts
- [[audit-logs.service.ts]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[audit-mutations.integration.ts]] - code - backend/src/integration-tests/audit-mutations.integration.ts
- [[auditLogSummaryPayload()]] - code - backend/src/modules/realtime/realtime-activity.payload.ts
- [[auditMock()]] - code - backend/src/modules/products/products.service.unit.spec.ts
- [[billing-usage.unit.spec.ts]] - code - backend/src/modules/billing/billing-usage.unit.spec.ts
- [[billingAccessMock()]] - code - backend/src/modules/products/products.service.unit.spec.ts
- [[buildProductsService()]] - code - backend/src/integration-tests/products-barcode.integration.ts
- [[buildService()_2]] - code - backend/src/modules/products/products.service.unit.spec.ts
- [[cases]] - code - backend/src/integration-tests/audit-mutations.integration.ts
- [[cases_1]] - code - backend/src/integration-tests/products-barcode.integration.ts
- [[coerce-boolean.ts]] - code - backend/src/common/utils/coerce-boolean.ts
- [[coerceOptionalBool()]] - code - backend/src/common/utils/coerce-boolean.ts
- [[companyAccessMock()_1]] - code - backend/src/modules/products/products.service.unit.spec.ts
- [[computeProductVolumeCbm()]] - code - backend/src/modules/products/product-volume.util.ts
- [[createdAt]] - code - backend/src/modules/products/products.service.unit.spec.ts
- [[customer-lifecycle.service.ts]] - code - backend/src/modules/companies/customer-lifecycle.service.ts
- [[deleteProduct()_1]] - code - backend/src/integration-tests/products-barcode.integration.ts
- [[generateBarcodeCandidate()]] - code - backend/src/common/generators/identifiers.ts
- [[generateLotCandidate()]] - code - backend/src/common/generators/identifiers.ts
- [[generateSkuCandidate()]] - code - backend/src/common/generators/identifiers.ts
- [[generatorsidentifiers.ts]] - code - backend/src/common/generators/identifiers.ts
- [[google-oauth.service.ts]] - code - backend/src/modules/auth/google-oauth.service.ts
- [[login-brute-force.service.unit.spec.ts]] - code - backend/src/common/security/login-brute-force.service.unit.spec.ts
- [[main()_29]] - code - backend/src/integration-tests/audit-mutations.integration.ts
- [[main()_30]] - code - backend/src/integration-tests/products-barcode.integration.ts
- [[mockAudit()]] - code - backend/src/common/security/login-brute-force.service.unit.spec.ts
- [[product-audit.util.ts]] - code - backend/src/modules/products/product-audit.util.ts
- [[product-volume.util.ts]] - code - backend/src/modules/products/product-volume.util.ts
- [[product-volume.util.unit.spec.ts]] - code - backend/src/modules/products/product-volume.util.unit.spec.ts
- [[productRow()]] - code - backend/src/modules/products/products.service.unit.spec.ts
- [[products-barcode.integration.ts]] - code - backend/src/integration-tests/products-barcode.integration.ts
- [[products.service.ts]] - code - backend/src/modules/products/products.service.ts
- [[products.service.unit.spec.ts]] - code - backend/src/modules/products/products.service.unit.spec.ts
- [[randomToken()_1]] - code - backend/src/common/generators/identifiers.ts
- [[realtime-activity.payload.ts]] - code - backend/src/modules/realtime/realtime-activity.payload.ts
- [[realtime-master-data.payload.ts]] - code - backend/src/modules/realtime/realtime-master-data.payload.ts
- [[realtimeMock()_1]] - code - backend/src/integration-tests/products-barcode.integration.ts
- [[redactAuditState()]] - code - backend/src/common/audit/audit-log-redaction.util.ts
- [[resolveProductVolumeCbmFromDims()]] - code - backend/src/modules/products/product-volume.util.ts
- [[slugifyForBarcode()]] - code - backend/src/common/generators/identifiers.ts
- [[superAdminPrincipal()]] - code - backend/src/integration-tests/products-barcode.integration.ts
- [[testArchivedBarcodeReuse()]] - code - backend/src/integration-tests/products-barcode.integration.ts
- [[testConcurrentBarcodeUpdates()]] - code - backend/src/integration-tests/products-barcode.integration.ts
- [[testConcurrentCreateAndUpdateRace()]] - code - backend/src/integration-tests/products-barcode.integration.ts
- [[toPositiveNumber()]] - code - backend/src/modules/products/product-volume.util.ts
- [[usedStorageFromInventory()]] - code - backend/src/modules/billing/billing-usage.unit.spec.ts
- [[userRealtimePayload()]] - code - backend/src/modules/realtime/realtime-master-data.payload.ts
- [[warehouses.service.ts]] - code - backend/src/modules/warehouses/warehouses.service.ts
- [[warehouses.service.unit.spec.ts]] - code - backend/src/modules/warehouses/warehouses.service.unit.spec.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/AuditLogService
SORT file.name ASC
```

## Connections to other communities
- 92 edges to [[_COMMUNITY_@prismaclient]]
- 24 edges to [[_COMMUNITY_@nestjscommon]]
- 21 edges to [[_COMMUNITY_RealtimeService]]
- 20 edges to [[_COMMUNITY_ProductsService]]
- 14 edges to [[_COMMUNITY_app.module.ts]]
- 13 edges to [[_COMMUNITY_testProductUpdateAuditHasBeforeAfter]]
- 12 edges to [[_COMMUNITY_WarehousesService]]
- 10 edges to [[_COMMUNITY_AuthPrincipal]]
- 9 edges to [[_COMMUNITY_cycle-count.service.ts]]
- 8 edges to [[_COMMUNITY_reliability-test-helpers.ts]]
- 8 edges to [[_COMMUNITY_outbound.service.ts]]
- 6 edges to [[_COMMUNITY_returns.service.ts]]
- 6 edges to [[_COMMUNITY_AuthService]]
- 6 edges to [[_COMMUNITY_AuditLogsService]]
- 6 edges to [[_COMMUNITY_product-delete-references.util.ts]]
- 5 edges to [[_COMMUNITY_task-inventory-effects.service.ts]]
- 5 edges to [[_COMMUNITY_dot-fromPrincipal]]
- 4 edges to [[_COMMUNITY_BillingInvoiceCalculationService]]
- 4 edges to [[_COMMUNITY_dot-login]]
- 4 edges to [[_COMMUNITY_NotificationsService]]
- 4 edges to [[_COMMUNITY_EmptyToUndefined]]
- 4 edges to [[_COMMUNITY_LocationsService]]
- 3 edges to [[_COMMUNITY_dot-assertCompanyAccess]]
- 3 edges to [[_COMMUNITY_shipping-fx.service.ts]]
- 3 edges to [[_COMMUNITY_inbound-orders-csv.service.ts]]
- 3 edges to [[_COMMUNITY_ListAuditLogsQueryDto]]
- 2 edges to [[_COMMUNITY_GoogleOAuthService]]
- 2 edges to [[_COMMUNITY_ReturnsService]]
- 2 edges to [[_COMMUNITY_inventory.service.ts]]
- 2 edges to [[_COMMUNITY_warehouse-tasks.service.ts]]
- 2 edges to [[_COMMUNITY_WarehouseTasksService]]
- 2 edges to [[_COMMUNITY_rbac-policy.ts]]
- 2 edges to [[_COMMUNITY_class-validator]]
- 2 edges to [[_COMMUNITY_ref_node_path]]
- 1 edge to [[_COMMUNITY_dot-validateResourceOwnership]]
- 1 edge to [[_COMMUNITY_MediaStorageService]]
- 1 edge to [[_COMMUNITY_CodRecordsService]]
- 1 edge to [[_COMMUNITY_CreateProductDto]]
- 1 edge to [[_COMMUNITY_UpdateProductDto]]
- 1 edge to [[_COMMUNITY_UsersService]]
- 1 edge to [[_COMMUNITY_ProductsController]]
- 1 edge to [[_COMMUNITY_withTenantRls]]
- 1 edge to [[_COMMUNITY_backendpackage.json]]

## Top bridge nodes
- [[AuditLogService]] - degree 60, connects to 18 communities
- [[products.service.ts]] - degree 56, connects to 14 communities
- [[audit-log.service.ts]] - degree 40, connects to 13 communities
- [[google-oauth.service.ts]] - degree 26, connects to 9 communities
- [[audit-logs.service.ts]] - degree 36, connects to 8 communities