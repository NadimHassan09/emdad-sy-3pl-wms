---
source_file: "backend/src/modules/reports/finance-reports.runner.ts"
type: "code"
community: "RunReportQueryDto"
location: "L120"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/RunReportQueryDto
---

# .receivablesAging()

## Connections
- [[dot-run()]] - `calls` [EXTRACTED]
- [[dot-tenantCompanyIds()]] - `calls` [EXTRACTED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[FinanceReportsRunner]] - `method` [EXTRACTED]
- [[RunReportQueryDto]] - `references` [EXTRACTED]
- [[computeDueDate()]] - `calls` [EXTRACTED]
- [[daysPastDue()]] - `calls` [EXTRACTED]
- [[fmtDate()]] - `calls` [EXTRACTED]
- [[paginate()]] - `calls` [EXTRACTED]
- [[receivablesAgingBucket()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/RunReportQueryDto