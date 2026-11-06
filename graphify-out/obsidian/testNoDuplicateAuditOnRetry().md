---
source_file: "backend/src/integration-tests/audit-mutations.integration.ts"
type: "code"
community: "testProductUpdateAuditHasBeforeAfter"
location: "L192"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/testProductUpdateAuditHasBeforeAfter
---

# testNoDuplicateAuditOnRetry()

## Connections
- [[dot-create()_5]] - `calls` [INFERRED]
- [[AuditLogService]] - `calls` [EXTRACTED]
- [[ProductsService]] - `calls` [EXTRACTED]
- [[audit-mutations.integration.ts]] - `indirect_call` [INFERRED]
- [[companyAccessMock()]] - `calls` [EXTRACTED]
- [[deleteProduct()]] - `calls` [EXTRACTED]
- [[fetchProductAudits()]] - `calls` [EXTRACTED]
- [[realtimeMock()]] - `calls` [EXTRACTED]
- [[superAdmin()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/testProductUpdateAuditHasBeforeAfter