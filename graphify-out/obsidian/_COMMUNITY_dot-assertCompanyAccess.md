---
type: community
cohesion: 0.08
members: 62
---

# .assertCompanyAccess

**Cohesion:** 0.08 - loosely connected
**Members:** 62 nodes

## Members
- [[dot-archive()_1]] - code - backend/src/modules/companies/companies.controller.ts
- [[dot-archive()_2]] - code - backend/src/modules/companies/customer-lifecycle.service.ts
- [[dot-assertCompanyAccess()]] - code - backend/src/common/company-access/company-access.service.ts
- [[dot-assertSameCompany()]] - code - backend/src/common/company-access/company-access.service.ts
- [[dot-close()]] - code - backend/src/modules/companies/companies.controller.ts
- [[dot-computePurgeBlockers()]] - code - backend/src/modules/companies/customer-lifecycle.service.ts
- [[dot-constructor()_203]] - code - backend/src/modules/companies/companies.controller.ts
- [[dot-create()_41]] - code - backend/src/modules/companies/companies.controller.ts
- [[dot-deleteLogo()]] - code - backend/src/modules/companies/companies.controller.ts
- [[dot-deleteLogo()_1]] - code - backend/src/modules/companies/companies.service.ts
- [[dot-emitLifecycle()]] - code - backend/src/modules/companies/customer-lifecycle.service.ts
- [[dot-ensureExists()]] - code - backend/src/modules/companies/companies.service.ts
- [[dot-findById()_13]] - code - backend/src/modules/companies/companies.service.ts
- [[dot-findByOrderNumber()_6]] - code - backend/src/modules/inbound/inbound.service.ts
- [[dot-findOne()_26]] - code - backend/src/modules/companies/companies.controller.ts
- [[dot-gatherCounts()]] - code - backend/src/modules/companies/customer-lifecycle.service.ts
- [[dot-generateArchiveExport()]] - code - backend/src/modules/companies/customer-lifecycle.service.ts
- [[dot-getCompanyOrThrow()]] - code - backend/src/modules/companies/customer-lifecycle.service.ts
- [[dot-getContext()]] - code - backend/src/modules/companies/customer-lifecycle.service.ts
- [[dot-hardDelete()_1]] - code - backend/src/modules/companies/customer-lifecycle.service.ts
- [[dot-lifecycleContext()]] - code - backend/src/modules/companies/companies.controller.ts
- [[dot-list()_51]] - code - backend/src/modules/companies/companies.controller.ts
- [[dot-list()_52]] - code - backend/src/modules/companies/companies.service.ts
- [[dot-logBestEffort()]] - code - backend/src/common/audit/audit-log.service.ts
- [[dot-purge()]] - code - backend/src/modules/companies/companies.controller.ts
- [[dot-purge()_1]] - code - backend/src/modules/companies/customer-lifecycle.service.ts
- [[dot-remove()_9]] - code - backend/src/modules/companies/companies.controller.ts
- [[dot-remove()_10]] - code - backend/src/modules/companies/companies.service.ts
- [[dot-restore()]] - code - backend/src/modules/companies/companies.controller.ts
- [[dot-restore()_1]] - code - backend/src/modules/companies/customer-lifecycle.service.ts
- [[dot-retentionDays()]] - code - backend/src/modules/companies/customer-lifecycle.service.ts
- [[dot-revokeCompanyUserSessions()]] - code - backend/src/modules/companies/customer-lifecycle.service.ts
- [[dot-softDelete()_2]] - code - backend/src/modules/companies/companies.service.ts
- [[dot-suspend()_4]] - code - backend/src/modules/companies/companies.controller.ts
- [[dot-suspend()_5]] - code - backend/src/modules/companies/companies.service.ts
- [[dot-suspend()_6]] - code - backend/src/modules/companies/customer-lifecycle.service.ts
- [[dot-update()_11]] - code - backend/src/modules/companies/companies.controller.ts
- [[dot-update()_12]] - code - backend/src/modules/companies/companies.service.ts
- [[dot-uploadLogo()_1]] - code - backend/src/modules/companies/companies.controller.ts
- [[Body_32]] - code
- [[CompaniesController]] - code - backend/src/modules/companies/companies.controller.ts
- [[CompaniesService]] - code - backend/src/modules/companies/companies.service.ts
- [[Controller_42]] - code
- [[CustomerLifecycleService]] - code - backend/src/modules/companies/customer-lifecycle.service.ts
- [[Delete_10]] - code
- [[Get_41]] - code
- [[HttpCode_3]] - code
- [[Injectable_142]] - code
- [[Injectable_143]] - code
- [[IsOptional_103]] - code
- [[IsString_84]] - code
- [[LifecycleActionDto]] - code - backend/src/modules/companies/dto/lifecycle.dto.ts
- [[MaxLength_48]] - code
- [[Param_33]] - code
- [[Patch_18]] - code
- [[Post_34]] - code
- [[Query_38]] - code
- [[UploadedFile_8]] - code
- [[UseGuards_34]] - code
- [[UseInterceptors_8]] - code
- [[assertUploadedImage()_2]] - code - backend/src/modules/companies/companies.controller.ts
- [[lifecycle.dto.ts]] - code - backend/src/modules/companies/dto/lifecycle.dto.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/assertCompanyAccess
SORT file.name ASC
```

## Connections to other communities
- 29 edges to [[_COMMUNITY_AuthPrincipal]]
- 12 edges to [[_COMMUNITY_CurrentUser]]
- 9 edges to [[_COMMUNITY_@prismaclient]]
- 7 edges to [[_COMMUNITY_dot-fromPrincipal]]
- 7 edges to [[_COMMUNITY_BillingController]]
- 7 edges to [[_COMMUNITY_BillingInvoiceCalculationService]]
- 6 edges to [[_COMMUNITY_@nestjscommon]]
- 6 edges to [[_COMMUNITY_UsersService]]
- 5 edges to [[_COMMUNITY_MediaStorageService]]
- 5 edges to [[_COMMUNITY_UpdateCompanyDto]]
- 5 edges to [[_COMMUNITY_withTenantRls]]
- 3 edges to [[_COMMUNITY_app.module.ts]]
- 3 edges to [[_COMMUNITY_AuditLogService]]
- 3 edges to [[_COMMUNITY_RunReportQueryDto]]
- 3 edges to [[_COMMUNITY_ClientBillingService]]
- 2 edges to [[_COMMUNITY_EmptyToUndefined]]
- 2 edges to [[_COMMUNITY_shipping-fx.service.ts]]
- 2 edges to [[_COMMUNITY_AuthService]]
- 2 edges to [[_COMMUNITY_RealtimeService]]
- 2 edges to [[_COMMUNITY_NotificationsService]]
- 2 edges to [[_COMMUNITY_CreateFinalContractDto]]
- 2 edges to [[_COMMUNITY_documents.controller.ts]]
- 1 edge to [[_COMMUNITY_outbound-orders-csv.service.ts]]
- 1 edge to [[_COMMUNITY_UsersController]]
- 1 edge to [[_COMMUNITY_inbound-orders-csv.service.ts]]
- 1 edge to [[_COMMUNITY_GoogleOAuthService]]
- 1 edge to [[_COMMUNITY_dot-validateResourceOwnership]]
- 1 edge to [[_COMMUNITY_WarehouseTasksService]]
- 1 edge to [[_COMMUNITY_ClientPrincipal]]
- 1 edge to [[_COMMUNITY_AuditLogsService]]
- 1 edge to [[_COMMUNITY_class-validator]]

## Top bridge nodes
- [[dot-assertCompanyAccess()]] - degree 52, connects to 14 communities
- [[CompaniesService]] - degree 18, connects to 6 communities
- [[dot-logBestEffort()]] - degree 14, connects to 6 communities
- [[dot-list()_52]] - degree 6, connects to 4 communities
- [[dot-assertSameCompany()]] - degree 5, connects to 4 communities