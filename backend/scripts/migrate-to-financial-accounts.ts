import { PrismaClient, CodRecordStatus, BillingInvoiceStatus } from '@prisma/client';

const prisma = new PrismaClient();

interface MigrationStats {
  companiesProcessed: number;
  accountsCreated: number;
  accountsExisting: number;
  codPendingImported: number;
  codAvailableImported: number;
  codExcluded: number;
  legacyInvoicesPreserved: number;
  errors: Array<{ companyId: string; error: string }>;
}

async function main() {
  console.log('====================================================');
  console.log('EMDAD Financial Management — Staging Migration Script');
  console.log('====================================================');

  const stats: MigrationStats = {
    companiesProcessed: 0,
    accountsCreated: 0,
    accountsExisting: 0,
    codPendingImported: 0,
    codAvailableImported: 0,
    codExcluded: 0,
    legacyInvoicesPreserved: 0,
    errors: [],
  };

  const companies = await prisma.company.findMany({
    select: { id: true, name: true, status: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${companies.length} companies to process.\n`);

  for (const company of companies) {
    stats.companiesProcessed++;
    try {
      // 1. Check or create ClientFinancialAccount
      let account = await prisma.clientFinancialAccount.findUnique({
        where: { companyId: company.id },
      });

      if (!account) {
        account = await prisma.clientFinancialAccount.create({
          data: {
            companyId: company.id,
            currentBalance: 0,
            availableBalance: 0,
            pendingBalance: 0,
            payoutLocked: 0,
            totalCredits: 0,
            totalDebits: 0,
            currency: 'USD',
            status: company.status === 'active' ? 'active' : 'restricted',
          },
        });
        stats.accountsCreated++;
      } else {
        stats.accountsExisting++;
      }

      // 2. Classify historical COD records
      const codRecords = await prisma.codRecord.findMany({
        where: { companyId: company.id },
        include: { adjustments: true },
      });

      let pendingSum = 0;
      let availableSum = 0;

      for (const rec of codRecords) {
        const adj = rec.adjustments.reduce((sum, a) => sum + Number(a.amount), 0);
        const net = Number(rec.originalAmount) + adj;

        if (rec.status === CodRecordStatus.pending) {
          stats.codPendingImported++;
          if (net > 0) pendingSum += net;
        } else if (rec.status === CodRecordStatus.available) {
          stats.codAvailableImported++;
          if (net > 0) availableSum += net;
        } else {
          // returned or paid_out
          stats.codExcluded++;
        }
      }

      // 3. Count historical invoices preserved
      const invoiceCount = await prisma.invoice.count({
        where: { companyId: company.id },
      });
      stats.legacyInvoicesPreserved += invoiceCount;

      // Update the account's pending balance safely if it is currently zero
      if (Number(account.pendingBalance) === 0 && pendingSum > 0) {
        await prisma.clientFinancialAccount.update({
          where: { companyId: company.id },
          data: {
            pendingBalance: pendingSum,
          },
        });
      }

      console.log(
        `✓ [${company.name}] (id: ${company.id}): Pending COD: $${pendingSum.toFixed(2)}, Available COD: $${availableSum.toFixed(2)}, Preserved Invoices: ${invoiceCount}`,
      );
    } catch (err: any) {
      console.error(`✗ Error processing company ${company.id}:`, err);
      stats.errors.push({ companyId: company.id, error: err.message });
    }
  }

  // 4. Ensure cutover_active policy is set
  await prisma.financialPolicy.upsert({
    where: { key: 'cutover_active' },
    create: {
      key: 'cutover_active',
      value: 'true',
      description: 'Whether Financial Management is the active financial system',
    },
    update: {
      value: 'true',
    },
  });

  console.log('\n====================================================');
  console.log('Migration Summary Report:');
  console.log('====================================================');
  console.log(`Total Companies Processed:        ${stats.companiesProcessed}`);
  console.log(`New Accounts Created:             ${stats.accountsCreated}`);
  console.log(`Existing Accounts Kept:           ${stats.accountsExisting}`);
  console.log(`Historical Pending COD Classified:${stats.codPendingImported}`);
  console.log(`Historical Available COD Checked: ${stats.codAvailableImported}`);
  console.log(`Historical Returned COD Excluded: ${stats.codExcluded}`);
  console.log(`Legacy Invoices Preserved:        ${stats.legacyInvoicesPreserved}`);
  console.log(`Errors Encountered:               ${stats.errors.length}`);
  console.log('Cutover Status:                   ACTIVE (cutover_active = true)');
  console.log('====================================================\n');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
