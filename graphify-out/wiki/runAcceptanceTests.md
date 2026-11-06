# runAcceptanceTests

> 21 nodes · cohesion 0.20

## Key Concepts

- **runAcceptanceTests()** (21 connections) — `backend/scripts/verify-financial-mvp.ts`
- **FinancialCodService** (15 connections) — `backend/src/modules/financial/financial-cod.service.ts`
- **FinancialPayoutsService** (15 connections) — `backend/src/modules/financial/financial-payouts.service.ts`
- **.postTransaction()** (10 connections) — `backend/src/modules/financial/financial-transactions.service.ts`
- **.updateBalances()** (8 connections) — `backend/src/modules/financial/financial-accounts.service.ts`
- **.requestPayout()** (8 connections) — `backend/src/modules/financial/financial-payouts.service.ts`
- **.recordPayoutPaid()** (7 connections) — `backend/src/modules/financial/financial-payouts.service.ts`
- **.ensureAccount()** (6 connections) — `backend/src/modules/financial/financial-accounts.service.ts`
- **.confirmCarrierCollection()** (6 connections) — `backend/src/modules/financial/financial-cod.service.ts`
- **.creditCodToAccount()** (6 connections) — `backend/src/modules/financial/financial-cod.service.ts`
- **.reviewPayout()** (6 connections) — `backend/src/modules/financial/financial-payouts.service.ts`
- **.getAccount()** (5 connections) — `backend/src/modules/financial/financial-accounts.service.ts`
- **.confirmCarrierRemittance()** (5 connections) — `backend/src/modules/financial/financial-cod.service.ts`
- **.constructor()** (5 connections) — `backend/src/modules/financial/financial-payouts.service.ts`
- **.getCodEligibility()** (4 connections) — `backend/src/modules/financial/financial-policies.service.ts`
- **.recordPendingCod()** (3 connections) — `backend/src/modules/financial/financial-cod.service.ts`
- **.recordShippingFeeCharge()** (3 connections) — `backend/src/modules/financial/financial-transactions.service.ts`
- **.generatePayoutNumber()** (2 connections) — `backend/src/modules/financial/financial-payouts.service.ts`
- **assert()** (1 connections) — `backend/scripts/verify-financial-mvp.ts`
- **Injectable** (1 connections)
- **Injectable** (1 connections)

## Relationships

- [client-financial.controller.ts](client-financial.controller.ts.md) (21 shared connections)
- [FinancialPoliciesService](FinancialPoliciesService.md) (8 shared connections)
- [ListFinancialTransactionsQueryDto](ListFinancialTransactionsQueryDto.md) (6 shared connections)
- [financial.controller.ts](financial.controller.ts.md) (6 shared connections)
- [FinancialController](FinancialController.md) (5 shared connections)
- [AuthPrincipal](AuthPrincipal.md) (4 shared connections)
- [FinancialCarrierCostsService](FinancialCarrierCostsService.md) (2 shared connections)
- [@prisma/client](@prisma-client.md) (1 shared connections)
- [.requestPayout](requestPayout.md) (1 shared connections)

## Source Files

- `backend/scripts/verify-financial-mvp.ts`
- `backend/src/modules/financial/financial-accounts.service.ts`
- `backend/src/modules/financial/financial-cod.service.ts`
- `backend/src/modules/financial/financial-payouts.service.ts`
- `backend/src/modules/financial/financial-policies.service.ts`
- `backend/src/modules/financial/financial-transactions.service.ts`

## Audit Trail

- EXTRACTED: 63 (66%)
- INFERRED: 33 (34%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*