---
source_file: "backend/src/integration-tests/audit-mutations.integration.ts"
type: "code"
community: "testProductUpdateAuditHasBeforeAfter"
location: "L154"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/testProductUpdateAuditHasBeforeAfter
---

# testAuditSurvivesCommittedTransaction()

## Connections
- [[dot-fromPrincipal()]] - `calls` [INFERRED]
- [[dot-logTx()]] - `calls` [INFERRED]
- [[AuditLogService]] - `calls` [EXTRACTED]
- [[audit-mutations.integration.ts]] - `indirect_call` [INFERRED]
- [[deleteProduct()]] - `calls` [EXTRACTED]
- [[fetchProductAudits()]] - `calls` [EXTRACTED]
- [[superAdmin()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/testProductUpdateAuditHasBeforeAfter