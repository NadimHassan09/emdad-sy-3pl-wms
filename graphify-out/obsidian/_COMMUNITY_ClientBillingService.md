---
type: community
cohesion: 0.09
members: 34
---

# ClientBillingService

**Cohesion:** 0.09 - loosely connected
**Members:** 34 nodes

## Members
- [[dot-assertBillingAccess()]] - code - backend/src/modules/client-portal/billing/client-billing.service.ts
- [[dot-constructor()_24]] - code - backend/src/modules/client-portal/billing/client-billing.controller.ts
- [[dot-constructor()_25]] - code - backend/src/modules/client-portal/dashboard/client-dashboard.controller.ts
- [[dot-constructor()_26]] - code - backend/src/modules/client-portal/dashboard/client-dashboard.service.ts
- [[dot-countExpiringProducts()]] - code - backend/src/modules/client-portal/dashboard/client-dashboard.service.ts
- [[dot-exportInvoices()]] - code - backend/src/modules/client-portal/billing/client-billing.controller.ts
- [[dot-exportInvoicesXlsx()]] - code - backend/src/modules/client-portal/billing/client-billing.service.ts
- [[dot-getInvoice()]] - code - backend/src/modules/client-portal/billing/client-billing.controller.ts
- [[dot-getInvoice()_1]] - code - backend/src/modules/client-portal/billing/client-billing.service.ts
- [[dot-getOverview()]] - code - backend/src/modules/client-portal/dashboard/client-dashboard.service.ts
- [[dot-getSummary()]] - code - backend/src/modules/client-portal/billing/client-billing.service.ts
- [[dot-list()_1]] - code - backend/src/modules/billing/billing-cycles.service.ts
- [[dot-list()_2]] - code - backend/src/modules/billing/billing-invoices.service.ts
- [[dot-list()_3]] - code - backend/src/modules/billing/billing-plans.service.ts
- [[dot-listInvoices()]] - code - backend/src/modules/client-portal/billing/client-billing.controller.ts
- [[dot-listInvoices()_1]] - code - backend/src/modules/client-portal/billing/client-billing.service.ts
- [[dot-listInvoicesPage()]] - code - backend/src/modules/client-portal/billing/client-billing.service.ts
- [[ClientBillingController]] - code - backend/src/modules/client-portal/billing/client-billing.controller.ts
- [[ClientBillingService]] - code - backend/src/modules/client-portal/billing/client-billing.service.ts
- [[ClientDashboardController]] - code - backend/src/modules/client-portal/dashboard/client-dashboard.controller.ts
- [[ClientDashboardService]] - code - backend/src/modules/client-portal/dashboard/client-dashboard.service.ts
- [[Controller_1]] - code
- [[Controller_2]] - code
- [[Get]] - code
- [[Injectable_8]] - code
- [[Injectable_9]] - code
- [[Param_1]] - code
- [[Query]] - code
- [[Res]] - code
- [[UseGuards]] - code
- [[UseGuards_1]] - code
- [[daysRemainingFromEnd()]] - code - backend/src/modules/client-portal/billing/client-billing.service.ts
- [[deriveAccountStatus()]] - code - backend/src/modules/client-portal/billing/client-billing.service.ts
- [[pickCurrentCycle()]] - code - backend/src/modules/client-portal/billing/client-billing.service.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/ClientBillingService
SORT file.name ASC
```

## Connections to other communities
- 24 edges to [[_COMMUNITY_ClientPrincipal]]
- 10 edges to [[_COMMUNITY_@nestjscommon]]
- 7 edges to [[_COMMUNITY_@prismaclient]]
- 5 edges to [[_COMMUNITY_BillingInvoiceCalculationService]]
- 3 edges to [[_COMMUNITY_BillingController]]
- 3 edges to [[_COMMUNITY_AuthPrincipal]]
- 3 edges to [[_COMMUNITY_dot-assertCompanyAccess]]
- 1 edge to [[_COMMUNITY_inbound-orders-csv.service.ts]]

## Top bridge nodes
- [[ClientBillingService]] - degree 15, connects to 4 communities
- [[dot-list()_1]] - degree 5, connects to 4 communities
- [[dot-list()_2]] - degree 5, connects to 3 communities
- [[dot-list()_3]] - degree 4, connects to 3 communities
- [[ClientBillingController]] - degree 11, connects to 2 communities