---
type: community
cohesion: 0.25
members: 15
---

# OmsShippingScanService

**Cohesion:** 0.25 - loosely connected
**Members:** 15 nodes

## Members
- [[dot-apply()]] - code - backend/src/modules/oms/oms-shipping-scan.service.ts
- [[dot-assertProviderAssociation()]] - code - backend/src/modules/oms/oms-shipping-scan.service.ts
- [[dot-confirmHandover()]] - code - backend/src/modules/oms/oms-shipping-scan.service.ts
- [[dot-confirmReadyToShip()]] - code - backend/src/modules/oms/oms-shipping-scan.service.ts
- [[dot-constructor()_80]] - code - backend/src/modules/oms/oms-shipping-scan.service.ts
- [[dot-findOrderForScan()]] - code - backend/src/modules/oms/oms-shipping-scan.service.ts
- [[dot-findShipmentByScan()]] - code - backend/src/modules/oms/oms-shipping-scan.service.ts
- [[dot-ok()]] - code - backend/src/modules/oms/oms-shipping-scan.service.ts
- [[dot-scanMatchesOrderOrActiveShipment()]] - code - backend/src/modules/oms/oms-shipping-scan.service.ts
- [[Inject_1]] - code
- [[Injectable_50]] - code
- [[OmsShippingScanAction]] - code - backend/src/modules/oms/dto/scan-shipping-transition.dto.ts
- [[OmsShippingScanService]] - code - backend/src/modules/oms/oms-shipping-scan.service.ts
- [[shipmentScanValues()]] - code - backend/src/modules/shipping/shipping-lifecycle.util.ts
- [[waybillScanAttempts()_1]] - code - backend/src/modules/shipping/shipping-lifecycle.util.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/OmsShippingScanService
SORT file.name ASC
```

## Connections to other communities
- 8 edges to [[_COMMUNITY_@prismaclient]]
- 5 edges to [[_COMMUNITY_AuthPrincipal]]
- 5 edges to [[_COMMUNITY_shipping-tracking.service.ts]]
- 2 edges to [[_COMMUNITY_withTenantRls]]
- 1 edge to [[_COMMUNITY_@nestjscommon]]
- 1 edge to [[_COMMUNITY_app.module.ts]]
- 1 edge to [[_COMMUNITY_CurrentUser]]
- 1 edge to [[_COMMUNITY_dot-fromPrincipal]]

## Top bridge nodes
- [[OmsShippingScanService]] - degree 15, connects to 3 communities
- [[dot-apply()]] - degree 11, connects to 3 communities
- [[dot-confirmHandover()]] - degree 6, connects to 2 communities
- [[dot-confirmReadyToShip()]] - degree 6, connects to 2 communities
- [[waybillScanAttempts()_1]] - degree 6, connects to 2 communities