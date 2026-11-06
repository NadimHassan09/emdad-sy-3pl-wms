# .assertCompanyAccess

> 62 nodes · cohesion 0.08

## Key Concepts

- **.assertCompanyAccess()** (52 connections) — `backend/src/common/company-access/company-access.service.ts`
- **CustomerLifecycleService** (19 connections) — `backend/src/modules/companies/customer-lifecycle.service.ts`
- **CompaniesService** (18 connections) — `backend/src/modules/companies/companies.service.ts`
- **CompaniesController** (17 connections) — `backend/src/modules/companies/companies.controller.ts`
- **.logBestEffort()** (14 connections) — `backend/src/common/audit/audit-log.service.ts`
- **Param** (11 connections)
- **UseGuards** (11 connections)
- **.purge()** (11 connections) — `backend/src/modules/companies/customer-lifecycle.service.ts`
- **.uploadLogo()** (10 connections) — `backend/src/modules/companies/companies.controller.ts`
- **.archive()** (10 connections) — `backend/src/modules/companies/customer-lifecycle.service.ts`
- **.archive()** (9 connections) — `backend/src/modules/companies/companies.controller.ts`
- **.restore()** (9 connections) — `backend/src/modules/companies/companies.controller.ts`
- **.suspend()** (9 connections) — `backend/src/modules/companies/companies.controller.ts`
- **.update()** (9 connections) — `backend/src/modules/companies/companies.controller.ts`
- **.update()** (9 connections) — `backend/src/modules/companies/companies.service.ts`
- **.suspend()** (9 connections) — `backend/src/modules/companies/customer-lifecycle.service.ts`
- **.deleteLogo()** (8 connections) — `backend/src/modules/companies/companies.controller.ts`
- **.getContext()** (8 connections) — `backend/src/modules/companies/customer-lifecycle.service.ts`
- **.hardDelete()** (8 connections) — `backend/src/modules/companies/customer-lifecycle.service.ts`
- **.restore()** (8 connections) — `backend/src/modules/companies/customer-lifecycle.service.ts`
- **LifecycleActionDto** (8 connections) — `backend/src/modules/companies/dto/lifecycle.dto.ts`
- **.close()** (7 connections) — `backend/src/modules/companies/companies.controller.ts`
- **.lifecycleContext()** (7 connections) — `backend/src/modules/companies/companies.controller.ts`
- **.list()** (7 connections) — `backend/src/modules/companies/companies.controller.ts`
- **.purge()** (7 connections) — `backend/src/modules/companies/companies.controller.ts`
- *... and 37 more nodes in this community*

## Relationships

- [AuthPrincipal](AuthPrincipal.md) (29 shared connections)
- [CurrentUser](CurrentUser.md) (12 shared connections)
- [@prisma/client](@prisma-client.md) (9 shared connections)
- [.fromPrincipal](fromPrincipal.md) (7 shared connections)
- [BillingInvoiceCalculationService](BillingInvoiceCalculationService.md) (7 shared connections)
- [BillingController](BillingController.md) (7 shared connections)
- [UsersService](UsersService.md) (6 shared connections)
- [@nestjs/common](@nestjs-common.md) (6 shared connections)
- [withTenantRls](withTenantRls.md) (5 shared connections)
- [MediaStorageService](MediaStorageService.md) (5 shared connections)
- [UpdateCompanyDto](UpdateCompanyDto.md) (5 shared connections)
- [AuditLogService](AuditLogService.md) (3 shared connections)

## Source Files

- `backend/src/common/audit/audit-log.service.ts`
- `backend/src/common/company-access/company-access.service.ts`
- `backend/src/modules/companies/companies.controller.ts`
- `backend/src/modules/companies/companies.service.ts`
- `backend/src/modules/companies/customer-lifecycle.service.ts`
- `backend/src/modules/companies/dto/lifecycle.dto.ts`
- `backend/src/modules/inbound/inbound.service.ts`

## Audit Trail

- EXTRACTED: 193 (70%)
- INFERRED: 84 (30%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*