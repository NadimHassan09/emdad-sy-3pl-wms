---
type: community
cohesion: 0.20
members: 21
---

# runAcceptanceTests

**Cohesion:** 0.20 - loosely connected
**Members:** 21 nodes

## Members
- [[dot-confirmCarrierCollection()]] - code - backend/src/modules/financial/financial-cod.service.ts
- [[dot-confirmCarrierRemittance()]] - code - backend/src/modules/financial/financial-cod.service.ts
- [[dot-constructor()_65]] - code - backend/src/modules/financial/financial-payouts.service.ts
- [[dot-creditCodToAccount()]] - code - backend/src/modules/financial/financial-cod.service.ts
- [[dot-ensureAccount()]] - code - backend/src/modules/financial/financial-accounts.service.ts
- [[dot-generatePayoutNumber()]] - code - backend/src/modules/financial/financial-payouts.service.ts
- [[dot-getAccount()_1]] - code - backend/src/modules/financial/financial-accounts.service.ts
- [[dot-getCodEligibility()]] - code - backend/src/modules/financial/financial-policies.service.ts
- [[dot-postTransaction()]] - code - backend/src/modules/financial/financial-transactions.service.ts
- [[dot-recordPayoutPaid()]] - code - backend/src/modules/financial/financial-payouts.service.ts
- [[dot-recordPendingCod()]] - code - backend/src/modules/financial/financial-cod.service.ts
- [[dot-recordShippingFeeCharge()]] - code - backend/src/modules/financial/financial-transactions.service.ts
- [[dot-requestPayout()]] - code - backend/src/modules/financial/financial-payouts.service.ts
- [[dot-reviewPayout()]] - code - backend/src/modules/financial/financial-payouts.service.ts
- [[dot-updateBalances()]] - code - backend/src/modules/financial/financial-accounts.service.ts
- [[FinancialCodService]] - code - backend/src/modules/financial/financial-cod.service.ts
- [[FinancialPayoutsService]] - code - backend/src/modules/financial/financial-payouts.service.ts
- [[Injectable_41]] - code
- [[Injectable_42]] - code
- [[assert()]] - code - backend/scripts/verify-financial-mvp.ts
- [[runAcceptanceTests()]] - code - backend/scripts/verify-financial-mvp.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/runAcceptanceTests
SORT file.name ASC
```

## Connections to other communities
- 21 edges to [[_COMMUNITY_client-financial.controller.ts]]
- 8 edges to [[_COMMUNITY_FinancialPoliciesService]]
- 6 edges to [[_COMMUNITY_financial.controller.ts]]
- 6 edges to [[_COMMUNITY_ListFinancialTransactionsQueryDto]]
- 5 edges to [[_COMMUNITY_FinancialController]]
- 4 edges to [[_COMMUNITY_AuthPrincipal]]
- 2 edges to [[_COMMUNITY_FinancialCarrierCostsService]]
- 1 edge to [[_COMMUNITY_@prismaclient]]
- 1 edge to [[_COMMUNITY_dot-requestPayout]]

## Top bridge nodes
- [[FinancialCodService]] - degree 15, connects to 4 communities
- [[FinancialPayoutsService]] - degree 15, connects to 4 communities
- [[runAcceptanceTests()]] - degree 21, connects to 3 communities
- [[dot-requestPayout()]] - degree 8, connects to 3 communities
- [[dot-recordPayoutPaid()]] - degree 7, connects to 3 communities