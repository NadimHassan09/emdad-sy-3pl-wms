---
source_file: "backend/src/modules/users/users.service.ts"
type: "code"
community: "UsersService"
location: "L208"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/UsersService
---

# .upsertWorkerProfile()

## Connections
- [[dot-assertCompanyAccess()]] - `calls` [INFERRED]
- [[dot-assertOperatorWorkerEligible()]] - `calls` [EXTRACTED]
- [[dot-linkExistingWorker()]] - `calls` [EXTRACTED]
- [[dot-resolveWorkerProvisionCompanyId()]] - `calls` [EXTRACTED]
- [[dot-resolveWorkerWarehouseId()]] - `calls` [EXTRACTED]
- [[dot-upsertWorkerProfile()_1]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[UpsertUserWorkerProfileDto]] - `references` [EXTRACTED]
- [[UserWorkerProfileSummary]] - `references` [EXTRACTED]
- [[UsersService]] - `method` [EXTRACTED]
- [[assertCanManageTargetRole()]] - `calls` [EXTRACTED]
- [[toWorkerProfileSummary()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/UsersService