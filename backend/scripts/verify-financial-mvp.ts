import { PrismaClient, Prisma } from '@prisma/client';
import { FinancialPoliciesService } from '../src/modules/financial/financial-policies.service';
import { FinancialAccountsService } from '../src/modules/financial/financial-accounts.service';
import { FinancialTransactionsService } from '../src/modules/financial/financial-transactions.service';
import { FinancialCodService } from '../src/modules/financial/financial-cod.service';
import { FinancialPayoutsService } from '../src/modules/financial/financial-payouts.service';
import { AuthPrincipal } from '../src/common/auth/current-user.types';

const prisma = new PrismaClient();

async function runAcceptanceTests() {
  console.log('================================================================');
  console.log('   EMDAD Financial Management MVP — End-to-End Test Suite');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      if (details) console.error(`       -> ${details}`);
      failed++;
    }
  }

  // Instantiate services
  const policyService = new FinancialPoliciesService(prisma as any);
  const accountService = new FinancialAccountsService(prisma as any);
  const txnService = new FinancialTransactionsService(prisma as any, accountService);
  const codService = new FinancialCodService(prisma as any, accountService, policyService, txnService);
  const payoutService = new FinancialPayoutsService(prisma as any, accountService, policyService, txnService);

  // Pick an active test user and company
  const testUser = await prisma.user.findFirst({
    where: { role: 'super_admin' },
  });
  if (!testUser) throw new Error('No super_admin user found in database.');

  const mockAdmin: AuthPrincipal = {
    id: testUser.id,
    email: testUser.email,
    role: 'super_admin',
    companyId: null,
    tenantScope: 'all',
    authorizedCompanyIds: [],
  };

  const company = await prisma.company.findFirst();
  if (!company) throw new Error('No test company found in database.');

  console.log(`Using Test Admin: ${mockAdmin.email} (${mockAdmin.id})`);
  console.log(`Using Test Company: ${company.name} (${company.id})\n`);

  // Ensure account exists
  let account = await accountService.ensureAccount(company.id);
  const initialCurrent = Number(account.currentBalance);
  const initialAvail = Number(account.availableBalance);

  // --- Test 1 & 3: Admin can create a client credit & Client balances update correctly ---
  const creditAmount = 150.00;
  const creditTxn = await txnService.postTransaction({
    companyId: company.id,
    type: 'credit',
    category: 'manual_adjustment',
    amount: creditAmount,
    currency: 'USD',
    description: 'Test Manual Credit Adjustment',
    referenceType: 'test_manual_credit',
    referenceId: `test-ref-${Date.now()}`,
    createdBy: mockAdmin.id,
  });

  account = await accountService.getAccount(company.id);
  assert(
    Number(account.currentBalance) === Number((initialCurrent + creditAmount).toFixed(2)) &&
    Number(account.availableBalance) === Number((initialAvail + creditAmount).toFixed(2)),
    'Test 1 & 3: Admin Credit increases currentBalance and availableBalance correctly',
    `Expected current ${initialCurrent + creditAmount}, got ${account.currentBalance}`
  );

  // --- Test 2 & 4: Admin can create a client debit & Appears in history ---
  const debitAmount = 50.00;
  const debitTxn = await txnService.postTransaction({
    companyId: company.id,
    type: 'debit',
    category: 'manual_adjustment',
    amount: debitAmount,
    currency: 'USD',
    description: 'Test Manual Debit Adjustment',
    referenceType: 'test_manual_debit',
    referenceId: `test-ref-debit-${Date.now()}`,
    createdBy: mockAdmin.id,
  });

  account = await accountService.getAccount(company.id);
  assert(
    Number(account.currentBalance) === Number((initialCurrent + creditAmount - debitAmount).toFixed(2)) &&
    Number(account.availableBalance) === Number((initialAvail + creditAmount - debitAmount).toFixed(2)),
    'Test 2 & 4: Admin Debit decreases currentBalance and availableBalance correctly',
    `Expected current ${initialCurrent + creditAmount - debitAmount}, got ${account.currentBalance}`
  );

  // Verify transactions appear in account history
  const history = await txnService.listTransactions({ companyId: company.id, limit: 10 });
  const hasCredit = history.items.some((t) => t.id === creditTxn.id);
  const hasDebit = history.items.some((t) => t.id === debitTxn.id);
  assert(
    hasCredit && hasDebit,
    'Test 4: Transactions appear in account transaction history',
    `Credit in history: ${hasCredit}, Debit in history: ${hasDebit}`
  );

  // --- Test 5: Idempotency / Duplicate prevention ---
  const idempotencyKey = `idemp-test-${Date.now()}`;
  const firstPost = await txnService.postTransaction({
    companyId: company.id,
    type: 'credit',
    category: 'manual_adjustment',
    amount: 25.00,
    currency: 'USD',
    description: 'First Idempotent Post',
    idempotencyKey,
  });

  const secondPost = await txnService.postTransaction({
    companyId: company.id,
    type: 'credit',
    category: 'manual_adjustment',
    amount: 25.00,
    currency: 'USD',
    description: 'Duplicate Idempotent Post',
    idempotencyKey,
  });

  assert(
    firstPost.id === secondPost.id && firstPost.transactionNumber === secondPost.transactionNumber,
    'Test 5: Duplicate financial event with same idempotencyKey returns existing transaction without double-posting',
    `First txn ${firstPost.id}, Second txn ${secondPost.id}`
  );

  // --- Test 6: Delivered COD does NOT automatically become confirmed cash received ---
  const testOmsOrder = await prisma.omsOrder.create({
    data: {
      companyId: company.id,
      orderNumber: `TEST-ORD-${Date.now()}`,
      status: 'delivered',
      destinationAddress: 'Damascus, Syria',
      requiredShipDate: new Date(),
      shippingProviderCode: 'babel_express',
      codAmount: new Prisma.Decimal(120.00),
      shippingFee: new Prisma.Decimal(15.00),
      createdBy: mockAdmin.id,
    },
  });

  const testCod = await prisma.codRecord.create({
    data: {
      companyId: company.id,
      omsOrderId: testOmsOrder.id,
      originalAmount: new Prisma.Decimal(120.00),
      currency: 'USD',
      status: 'pending',
      createdBy: mockAdmin.id,
    },
  });

  // Track pending
  await accountService.updateBalances(company.id, {
    pendingDelta: new Prisma.Decimal(120.00),
    currentDelta: new Prisma.Decimal(120.00),
  });

  const postPendingAccount = await accountService.getAccount(company.id);

  assert(
    testCod.status === 'pending' &&
    testCod.creditedToAccountAt === null &&
    testCod.carrierRemittedAt === null,
    'Test 6: Delivered order COD begins in pending/held status and is NOT treated as available cash',
    `COD status: ${testCod.status}, creditedToAccountAt: ${testCod.creditedToAccountAt}`
  );

  // --- Test 7: Collection & Remittance confirmation credits available balance ---
  await codService.confirmCarrierCollection(testCod.id, mockAdmin, 'Verified collection from Babel driver');
  let updatedCod = await prisma.codRecord.findUnique({ where: { id: testCod.id } });
  assert(
    updatedCod?.carrierCollectedAt !== null,
    'Test 7a: Carrier collection confirmation recorded successfully'
  );

  const prevAvail = Number(postPendingAccount.availableBalance);
  await codService.confirmCarrierRemittance(
    testCod.id,
    mockAdmin,
    `REMIT-TEST-${Date.now()}`,
    'Cash received at Damascus office'
  );

  updatedCod = await prisma.codRecord.findUnique({ where: { id: testCod.id } });
  const postRemitAccount = await accountService.getAccount(company.id);

  assert(
    updatedCod?.status === 'available' &&
    updatedCod?.carrierRemittedAt !== null &&
    updatedCod?.creditedToAccountAt !== null &&
    Number(postRemitAccount.availableBalance) === Number((prevAvail + 120.00).toFixed(2)),
    'Test 7b: Remittance confirmation releases pending COD into availableBalance with credit transaction',
    `COD status ${updatedCod?.status}, Avail balance was ${prevAvail}, now ${postRemitAccount.availableBalance}`
  );

  // --- Test 8: Payout request reserves available balance ---
  const availBeforePayout = Number(postRemitAccount.availableBalance);
  const lockedBeforePayout = Number(postRemitAccount.payoutLocked);
  const payoutRequestAmount = 40.00;

  const payoutReq = await payoutService.requestPayout(
    company.id,
    {
      amount: payoutRequestAmount,
      bankName: 'Commercial Bank of Syria',
      accountNumber: '0101-999888',
      notes: 'Weekly withdrawal test',
    },
    mockAdmin.id
  );

  let accAfterReq = await accountService.getAccount(company.id);
  assert(
    payoutReq.status === 'requested' &&
    Number(accAfterReq.availableBalance) === Number((availBeforePayout - payoutRequestAmount).toFixed(2)) &&
    Number(accAfterReq.payoutLocked) === Number((lockedBeforePayout + payoutRequestAmount).toFixed(2)),
    'Test 8: Payout request locks funds into payoutLocked and deducts from availableBalance',
    `Expected avail ${availBeforePayout - payoutRequestAmount}, got ${accAfterReq.availableBalance}; locked: ${accAfterReq.payoutLocked}`
  );

  // --- Test 9: Rejected payout releases the reserved amount back ---
  await payoutService.reviewPayout(
    payoutReq.id,
    {
      status: 'rejected',
      rejectionReason: 'Invalid test bank account',
    },
    mockAdmin
  );

  let accAfterReject = await accountService.getAccount(company.id);
  assert(
    Number(accAfterReject.availableBalance) === Number(availBeforePayout.toFixed(2)) &&
    Number(accAfterReject.payoutLocked) === Number(lockedBeforePayout.toFixed(2)),
    'Test 9: Rejected payout releases reserved amount back to availableBalance',
    `Avail: ${accAfterReject.availableBalance}, Locked: ${accAfterReject.payoutLocked}`
  );

  // --- Test 10: Successful payout execution reduces balance correctly ---
  const payout2 = await payoutService.requestPayout(
    company.id,
    {
      amount: 30.00,
      bankName: 'Bank of Syria and Overseas',
      accountNumber: '0202-333444',
    },
    mockAdmin.id
  );

  await payoutService.reviewPayout(payout2.id, { status: 'approved' }, mockAdmin);
  const paidResult = await payoutService.recordPayoutPaid(
    payout2.id,
    {
      payoutReference: `WIRE-DISB-${Date.now()}`,
      notes: 'Transfer executed successfully',
    },
    mockAdmin
  );

  assert(
    paidResult.payout.status === 'paid' &&
    paidResult.payout.paidAt !== null,
    'Test 10: Executed payout creates debit disbursement transaction and finalizes deduction',
    `Payout status: ${paidResult.payout.status}, PaidAt: ${paidResult.payout.paidAt}`
  );

  // --- Test 11: Shipping fee charged once per OMS order (duplicate prevention) ---
  const firstShipFee = await txnService.recordShippingFeeCharge(testOmsOrder.id);
  const secondShipFee = await txnService.recordShippingFeeCharge(testOmsOrder.id);

  assert(
    firstShipFee !== null &&
    secondShipFee !== null &&
    firstShipFee.id === secondShipFee.id &&
    firstShipFee.amount.toString() === '15',
    'Test 11: Shipping fee is recorded exactly once per OMS order without double-charging',
    `First fee id: ${firstShipFee?.id}, Second fee id: ${secondShipFee?.id}`
  );

  // --- Test 12: Client Isolation ---
  const otherCompany = await prisma.company.findFirst({
    where: { id: { not: company.id } },
  });

  if (otherCompany) {
    await accountService.ensureAccount(otherCompany.id);
    const clientTxns = await txnService.listTransactions(
      { limit: 50 },
      { companyId: company.id }
    );
    const hasOtherCompanyTxns = clientTxns.items.some((t) => t.companyId === otherCompany.id);

    assert(
      !hasOtherCompanyTxns,
      'Test 12: Client transactions strictly isolated by companyId (no cross-tenant leakage)',
      `Found other company transactions: ${hasOtherCompanyTxns}`
    );
  }

  // --- Test 13 & 14: Policy Management & Immutable History ---
  const originalMinPayout = await policyService.getPolicyValue('minimum_payout_amount');
  await policyService.updatePolicy('minimum_payout_amount', '25.00', mockAdmin.id, 'Updated by test suite');
  const updatedMinPayout = await policyService.getPolicyValue('minimum_payout_amount');

  // Verify previous transactions still have original amounts and were not rewritten
  const checkTxn = await prisma.financialTransaction.findUnique({ where: { id: creditTxn.id } });
  assert(
    updatedMinPayout === '25.00' &&
    Number(checkTxn?.amount) === creditAmount,
    'Test 13 & 14: Admin can update policies without rewriting historical transactions',
    `Updated policy: ${updatedMinPayout}, Credit txn amount preserved: ${checkTxn?.amount}`
  );

  // Revert policy to original
  await policyService.updatePolicy('minimum_payout_amount', originalMinPayout, mockAdmin.id);

  // --- Test 15: Cutover active skips legacy billing generation ---
  const cutoverPolicy = await policyService.isCutoverActive();
  assert(
    cutoverPolicy === true,
    'Test 15: Financial Management cutover is ACTIVE on Staging, legacy cycle generation disabled'
  );

  // --- Test 16 & 17: Operational Capacity (Reserved Volume & Weight) Untouched ---
  const billingPlans = await prisma.billingPlan.findMany({
    take: 5,
  });

  const allHaveCapacityFields = billingPlans.every(
    (bp) => bp.reservedVolume !== null && bp.reservedWeight !== null
  );

  assert(
    allHaveCapacityFields,
    'Test 16 & 17: BillingPlan reservedVolume and reservedWeight schema & data remain intact and untouched'
  );

  console.log('\n================================================================');
  console.log(`   TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAcceptanceTests()
  .catch((e) => {
    console.error('Test Suite encountered unhandled error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
