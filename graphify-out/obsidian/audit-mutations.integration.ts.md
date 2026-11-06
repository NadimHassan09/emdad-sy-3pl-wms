---
source_file: "backend/src/integration-tests/audit-mutations.integration.ts"
type: "code"
community: "AuditLogService"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/AuditLogService
---

# audit-mutations.integration.ts

## Connections
- [[@nestjscommon]] - `imports_from` [EXTRACTED]
- [[@prismaclient]] - `imports_from` [EXTRACTED]
- [[AuditLogService]] - `imports` [EXTRACTED]
- [[AuditRow]] - `contains` [EXTRACTED]
- [[AuthPrincipal]] - `imports` [EXTRACTED]
- [[CompanyAccessService]] - `imports` [EXTRACTED]
- [[PrismaService]] - `imports` [EXTRACTED]
- [[ProductsService]] - `imports` [EXTRACTED]
- [[RealtimeService]] - `imports` [EXTRACTED]
- [[audit-log.service.ts]] - `imports_from` [EXTRACTED]
- [[cases]] - `contains` [EXTRACTED]
- [[company-access.service.ts]] - `imports_from` [EXTRACTED]
- [[companyAccessMock()]] - `contains` [EXTRACTED]
- [[current-user.types.ts]] - `imports_from` [EXTRACTED]
- [[deleteProduct()]] - `contains` [EXTRACTED]
- [[fetchProductAudits()]] - `contains` [EXTRACTED]
- [[main()_29]] - `contains` [EXTRACTED]
- [[prisma.service.ts]] - `imports_from` [EXTRACTED]
- [[products.service.ts]] - `imports_from` [EXTRACTED]
- [[realtime.service.ts]] - `imports_from` [EXTRACTED]
- [[realtimeMock()]] - `contains` [EXTRACTED]
- [[ref_node_assert]] - `imports_from` [EXTRACTED]
- [[ref_node_crypto]] - `imports_from` [EXTRACTED]
- [[superAdmin()]] - `contains` [EXTRACTED]
- [[testAuditSurvivesCommittedTransaction()]] - `indirect_call` [INFERRED]
- [[testNoDuplicateAuditOnRetry()]] - `indirect_call` [INFERRED]
- [[testProductCreateAudit()]] - `indirect_call` [INFERRED]
- [[testProductUpdateAuditHasBeforeAfter()]] - `indirect_call` [INFERRED]

#graphify/code #graphify/EXTRACTED #community/AuditLogService