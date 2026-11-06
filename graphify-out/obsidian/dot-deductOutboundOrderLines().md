---
source_file: "backend/src/modules/outbound/outbound.service.ts"
type: "code"
community: "withTenantRls"
location: "L2835"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/withTenantRls
---

# .deductOutboundOrderLines()

## Connections
- [[dot-appendIfAbsent()]] - `calls` [INFERRED]
- [[dot-confirmAndDeduct()]] - `calls` [EXTRACTED]
- [[dot-decrementWithMeta()]] - `calls` [INFERRED]
- [[dot-findStockCandidates()]] - `calls` [EXTRACTED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[InsufficientStockException]] - `calls` [EXTRACTED]
- [[OutboundService]] - `method` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/withTenantRls