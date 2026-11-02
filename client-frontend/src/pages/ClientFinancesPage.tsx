import { useState, type ReactElement, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Badge, Button, Card, Input, Modal, Skeleton } from '@ds';

import { isClientArabic } from '../lib/client-ui-language';
import { ClientFinancesService } from '../services/clientFinancesService';

function t(en: string, ar: string, isAr: boolean): string {
  return isAr ? ar : en;
}

export function ClientFinancesPage(): ReactElement {
  const isAr = isClientArabic();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<'statement' | 'payouts' | 'cod'>('statement');
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [iban, setIban] = useState('');
  const [notes, setNotes] = useState('');
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [payoutSuccess, setPayoutSuccess] = useState<string | null>(null);

  // Statement Filters
  const [statementType, setStatementType] = useState<string>('');
  const [statementStartDate, setStatementStartDate] = useState<string>('');
  const [statementEndDate, setStatementEndDate] = useState<string>('');
  const [statementPage, setStatementPage] = useState<number>(1);

  // Payouts Page
  const [payoutsPage, setPayoutsPage] = useState<number>(1);

  // COD Page
  const [codSearch, setCodSearch] = useState<string>('');
  const [codStatus, setCodStatus] = useState<string>('');
  const [codPage, setCodPage] = useState<number>(1);

  // 1. Account Summary Query
  const { data: account, isLoading: accountLoading, error: accountError } = useQuery({
    queryKey: ['client', 'finances', 'account'],
    queryFn: () => ClientFinancesService.getAccount(),
  });

  // 2. Transactions Query
  const { data: txnsData, isLoading: txnsLoading } = useQuery({
    queryKey: [
      'client',
      'finances',
      'transactions',
      { type: statementType, startDate: statementStartDate, endDate: statementEndDate, page: statementPage },
    ],
    queryFn: () =>
      ClientFinancesService.getTransactions({
        type: statementType || undefined,
        startDate: statementStartDate || undefined,
        endDate: statementEndDate || undefined,
        page: statementPage,
        limit: 20,
      }),
  });

  // 3. Payouts Query
  const { data: payoutsData, isLoading: payoutsLoading } = useQuery({
    queryKey: ['client', 'finances', 'payouts', { page: payoutsPage }],
    queryFn: () => ClientFinancesService.getPayouts({ page: payoutsPage, limit: 20 }),
  });

  // 4. COD Query
  const { data: codData, isLoading: codLoading } = useQuery({
    queryKey: ['client', 'finances', 'cod', { search: codSearch, status: codStatus, page: codPage }],
    queryFn: () =>
      ClientFinancesService.getCod({
        search: codSearch || undefined,
        status: codStatus || undefined,
        page: codPage,
        limit: 20,
      }),
  });

  // Request Payout Mutation
  const payoutMut = useMutation({
    mutationFn: (payload: { amount: number; bankName?: string; accountNumber?: string; iban?: string; notes?: string }) =>
      ClientFinancesService.requestPayout(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['client', 'finances'] });
      setPayoutModalOpen(false);
      setPayoutAmount('');
      setBankName('');
      setAccountNumber('');
      setIban('');
      setNotes('');
      setPayoutError(null);
      setPayoutSuccess(
        t(
          'Payout request submitted successfully. Funds are reserved and awaiting transfer.',
          'تم تقديم طلب السحب بنجاح. تم حجز المبلغ وبانتظار التحويل.',
          isAr,
        ),
      );
      setTimeout(() => setPayoutSuccess(null), 6000);
    },
    onError: (err: any) => {
      setPayoutError(err.response?.data?.message ?? err.message ?? 'Failed to submit payout request');
    },
  });

  const handleOpenPayoutModal = () => {
    setPayoutAmount('');
    setPayoutError(null);
    setPayoutModalOpen(true);
  };

  const handleSubmitPayout = (e: FormEvent) => {
    e.preventDefault();
    const num = parseFloat(payoutAmount);
    const available = Number(account?.availableBalance ?? 0);

    if (isNaN(num) || num <= 0) {
      setPayoutError(t('Please enter a valid payout amount', 'يرجى إدخال مبلغ سحب صالح', isAr));
      return;
    }
    if (num > available) {
      setPayoutError(
        t(
          `Requested amount ($${num.toFixed(2)}) exceeds your available balance ($${available.toFixed(2)})`,
          `المبلغ المطلوب ($${num.toFixed(2)}) يتجاوز رصيدك المتاح ($${available.toFixed(2)})`,
          isAr,
        ),
      );
      return;
    }

    payoutMut.mutate({
      amount: num,
      bankName: bankName.trim() || undefined,
      accountNumber: accountNumber.trim() || undefined,
      iban: iban.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-text-strong">
            {t('Financial Account', 'الحساب المالي للعميل', isAr)}
          </h1>
          <p className="mt-1 text-xs text-text-muted">
            {t(
              'Your current account balance, COD settlements, transaction history, and payout disbursements',
              'رصيد حسابك الجاري، تسويات الدفع عند الاستلام، كشف الحركات المالية وطلبات السحب',
              isAr,
            )}
          </p>
        </div>

        <Button
          variant="primary"
          onClick={handleOpenPayoutModal}
          disabled={!account || Number(account.availableBalance) <= 0}
        >
          {t('Request Payout', 'طلب سحب رصيد', isAr)}
        </Button>
      </div>

      {payoutSuccess ? (
        <Alert variant="success" className="mb-4">
          {payoutSuccess}
        </Alert>
      ) : null}

      {accountError ? (
        <Alert variant="error" className="mb-4">
          {t('Failed to load financial account.', 'تعذر تحميل بيانات الحساب المالي.', isAr)}
        </Alert>
      ) : null}

      {/* Account Balance KPI Cards */}
      {accountLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : account ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Available Balance */}
          <Card padding="md" className="border-emerald-200/60 bg-emerald-50/20 dark:border-emerald-900/40">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
              {t('Available Balance', 'الرصيد المتاح للسحب', isAr)}
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              ${Number(account.availableBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="mt-2 text-xs text-text-muted">
              {t('Ready for immediate withdrawal', 'متاح لتقديم طلب سحب أو تسوية', isAr)}
            </p>
          </Card>

          {/* Pending COD */}
          <Card padding="md" className="border-amber-200/60 bg-amber-50/20 dark:border-amber-900/40">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
              {t('Pending / Held COD', 'مبالغ COD قيد التحصيل', isAr)}
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
              ${Number(account.pendingBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="mt-2 text-xs text-text-muted">
              {t('Released upon carrier collection/remittance', 'تُتاح بمجرد استلام التحصيل من شركة الشحن', isAr)}
            </p>
          </Card>

          {/* Reserved in Payouts */}
          <Card padding="md">
            <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
              {t('Reserved in Payouts', 'محجوز في طلبات السحب', isAr)}
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-text-strong">
              ${Number(account.payoutLocked).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="mt-2 text-xs text-text-muted">
              {t('Locked awaiting bank transfer execution', 'مبالغ قيد التنفيذ والتحويل البنكي', isAr)}
            </p>
          </Card>

          {/* Total Current Ledger Balance */}
          <Card padding="md">
            <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
              {t('Total Account Balance', 'إجمالي الرصيد الجاري', isAr)}
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-brand-600 dark:text-brand-400">
              ${Number(account.currentBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="mt-2 text-xs text-text-muted">
              {t('Net available + pending balance', 'صافي الرصيد الدائن المتاح والمعلّق', isAr)}
            </p>
          </Card>
        </div>
      ) : null}

      {/* Sub-Navigation Tabs */}
      <div className="border-b border-border-subtle">
        <nav className="flex space-x-6 rtl:space-x-reverse" aria-label="Tabs">
          {[
            { id: 'statement', labelEn: 'Account Statement', labelAr: 'كشف الحساب الحركي' },
            { id: 'payouts', labelEn: 'Payout Requests', labelAr: 'طلبات السحب والتحويلات' },
            { id: 'cod', labelEn: 'COD Movements', labelAr: 'حركات الدفع عند الاستلام' },
          ].map((tab) => {
            const isCurrent = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`border-b-2 py-3 px-1 text-sm font-semibold transition-colors ${
                  isCurrent
                    ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                    : 'border-transparent text-text-muted hover:border-neutral-300 hover:text-text-strong'
                }`}
              >
                {t(tab.labelEn, tab.labelAr, isAr)}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab 1: Account Statement */}
      {activeTab === 'statement' ? (
        <div className="space-y-4">
          {/* Statement Filters */}
          <Card padding="md">
            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-text-muted">
                  {t('Type', 'نوع الحركة', isAr)}
                </label>
                <select
                  value={statementType}
                  onChange={(e) => {
                    setStatementType(e.target.value);
                    setStatementPage(1);
                  }}
                  className="w-full rounded border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-strong"
                >
                  <option value="">{t('All Movements', 'كل الحركات', isAr)}</option>
                  <option value="credit">{t('Credit (+) Income', 'دائن (+) واردات', isAr)}</option>
                  <option value="debit">{t('Debit (-) Charges & Payouts', 'مدين (-) رسوم ومسحوبات', isAr)}</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-text-muted">
                  {t('From Date', 'من تاريخ', isAr)}
                </label>
                <Input
                  type="date"
                  value={statementStartDate}
                  onChange={(e) => {
                    setStatementStartDate(e.target.value);
                    setStatementPage(1);
                  }}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-text-muted">
                  {t('To Date', 'إلى تاريخ', isAr)}
                </label>
                <Input
                  type="date"
                  value={statementEndDate}
                  onChange={(e) => {
                    setStatementEndDate(e.target.value);
                    setStatementPage(1);
                  }}
                />
              </div>

              <div className="flex items-end justify-between">
                {statementType || statementStartDate || statementEndDate ? (
                  <button
                    type="button"
                    onClick={() => {
                      setStatementType('');
                      setStatementStartDate('');
                      setStatementEndDate('');
                      setStatementPage(1);
                    }}
                    className="text-xs text-brand-600 hover:underline"
                  >
                    {t('Clear filters ✕', 'إلغاء الفلاتر ✕', isAr)}
                  </button>
                ) : <span />}
                <span className="text-xs text-text-muted">
                  {t(`Total: ${txnsData?.total ?? 0} transactions`, `الإجمالي: ${txnsData?.total ?? 0} حركة`, isAr)}
                </span>
              </div>
            </div>
          </Card>

          {/* Transactions Table */}
          <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm rtl:text-right">
                <thead className="border-b border-border-subtle bg-neutral-50 text-[11px] font-bold uppercase tracking-wider text-text-muted dark:bg-neutral-900/50">
                  <tr>
                    <th className="px-4 py-3">{t('Transaction #', 'رقم الحركة', isAr)}</th>
                    <th className="px-4 py-3">{t('Date', 'التاريخ', isAr)}</th>
                    <th className="px-4 py-3 text-center">{t('Type', 'النوع', isAr)}</th>
                    <th className="px-4 py-3">{t('Category', 'التصنيف', isAr)}</th>
                    <th className="px-4 py-3 text-right rtl:text-left">{t('Amount', 'المبلغ', isAr)}</th>
                    <th className="px-4 py-3">{t('Reference', 'المرجع', isAr)}</th>
                    <th className="px-4 py-3">{t('Description', 'البيان', isAr)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {txnsLoading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center">
                        <Skeleton className="h-6 w-full" />
                      </td>
                    </tr>
                  ) : (txnsData?.items ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-text-muted">
                        {t('No transactions recorded for the selected period.', 'لا توجد حركات مسجلة للفترة المحددة.', isAr)}
                      </td>
                    </tr>
                  ) : (
                    txnsData!.items.map((txn) => {
                      const isCredit = txn.type === 'credit';
                      return (
                        <tr key={txn.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30">
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-text-strong">
                            {txn.transactionNumber}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-text-muted">
                            {new Date(txn.createdAt).toLocaleDateString()} {new Date(txn.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge tone={isCredit ? 'success' : 'danger'}>
                              {isCredit ? t('+ Credit', '+ دائن', isAr) : t('- Debit', '- مدين', isAr)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs font-medium text-text-muted">
                            {txn.category.replace(/_/g, ' ')}
                          </td>
                          <td
                            className={`px-4 py-3 text-right rtl:text-left font-bold tabular-nums ${
                              isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {isCredit ? '+' : '-'}${Number(txn.amount).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-xs text-text-muted">
                            {txn.referenceType ? (
                              <span className="font-mono">{txn.referenceType}: {txn.referenceId?.slice(0, 10)}</span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="max-w-xs truncate px-4 py-3 text-xs text-text-strong" title={txn.description}>
                            {txn.description}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {txnsData && txnsData.totalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-border-subtle px-4 py-3">
                <button
                  disabled={statementPage <= 1}
                  onClick={() => setStatementPage((p) => Math.max(1, p - 1))}
                  className="rounded px-3 py-1 text-xs font-semibold text-text-strong hover:bg-neutral-100 disabled:opacity-40"
                >
                  {t('Previous', 'السابق', isAr)}
                </button>
                <span className="text-xs text-text-muted">
                  {t(`Page ${statementPage} of ${txnsData.totalPages}`, `صفحة ${statementPage} من ${txnsData.totalPages}`, isAr)}
                </span>
                <button
                  disabled={statementPage >= txnsData.totalPages}
                  onClick={() => setStatementPage((p) => Math.min(txnsData.totalPages, p + 1))}
                  className="rounded px-3 py-1 text-xs font-semibold text-text-strong hover:bg-neutral-100 disabled:opacity-40"
                >
                  {t('Next', 'التالي', isAr)}
                </button>
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}

      {/* Tab 2: Payout Requests */}
      {activeTab === 'payouts' ? (
        <div className="space-y-4">
          <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm rtl:text-right">
                <thead className="border-b border-border-subtle bg-neutral-50 text-[11px] font-bold uppercase tracking-wider text-text-muted dark:bg-neutral-900/50">
                  <tr>
                    <th className="px-4 py-3">{t('Payout #', 'رقم الطلب', isAr)}</th>
                    <th className="px-4 py-3">{t('Date Requested', 'تاريخ الطلب', isAr)}</th>
                    <th className="px-4 py-3 text-right rtl:text-left">{t('Amount', 'المبلغ', isAr)}</th>
                    <th className="px-4 py-3 text-center">{t('Status', 'الحالة', isAr)}</th>
                    <th className="px-4 py-3">{t('Bank Details', 'تفاصيل الحساب البنكي', isAr)}</th>
                    <th className="px-4 py-3">{t('Transfer Reference', 'مرجع الحوالة', isAr)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {payoutsLoading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center">
                        <Skeleton className="h-6 w-full" />
                      </td>
                    </tr>
                  ) : (payoutsData?.items ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-text-muted">
                        {t('No payout requests submitted yet.', 'لم يتم تقديم أي طلبات سحب حتى الآن.', isAr)}
                      </td>
                    </tr>
                  ) : (
                    payoutsData!.items.map((p) => (
                      <tr key={p.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-text-strong">
                          {p.payoutNumber}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-text-muted">
                          {new Date(p.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right rtl:text-left font-bold tabular-nums text-text-strong">
                          ${Number(p.amount).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge
                            tone={
                              p.status === 'paid'
                                ? 'success'
                                : p.status === 'approved'
                                  ? 'brand'
                                  : p.status === 'rejected'
                                    ? 'danger'
                                    : 'warning'
                            }
                          >
                            {p.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-text-muted">
                          {p.bankName ? (
                            <div>
                              <span className="font-semibold text-text-strong">{p.bankName}</span>
                              {p.accountNumber ? <span> · {p.accountNumber}</span> : null}
                              {p.iban ? <div className="font-mono text-[10px]">IBAN: {p.iban}</div> : null}
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-text-muted">
                          {p.payoutReference ? (
                            <span className="font-mono font-medium text-emerald-600">{p.payoutReference}</span>
                          ) : p.rejectionReason ? (
                            <span className="text-rose-600">{p.rejectionReason}</span>
                          ) : (
                            <span className="text-text-muted">{t('Awaiting transfer', 'بانتظار التحويل', isAr)}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {payoutsData && payoutsData.totalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-border-subtle px-4 py-3">
                <button
                  disabled={payoutsPage <= 1}
                  onClick={() => setPayoutsPage((p) => Math.max(1, p - 1))}
                  className="rounded px-3 py-1 text-xs font-semibold text-text-strong hover:bg-neutral-100 disabled:opacity-40"
                >
                  {t('Previous', 'السابق', isAr)}
                </button>
                <span className="text-xs text-text-muted">
                  {t(`Page ${payoutsPage} of ${payoutsData.totalPages}`, `صفحة ${payoutsPage} من ${payoutsData.totalPages}`, isAr)}
                </span>
                <button
                  disabled={payoutsPage >= payoutsData.totalPages}
                  onClick={() => setPayoutsPage((p) => Math.min(payoutsData.totalPages, p + 1))}
                  className="rounded px-3 py-1 text-xs font-semibold text-text-strong hover:bg-neutral-100 disabled:opacity-40"
                >
                  {t('Next', 'التالي', isAr)}
                </button>
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}

      {/* Tab 3: COD Movements */}
      {activeTab === 'cod' ? (
        <div className="space-y-4">
          <Card padding="md">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-64">
                  <Input
                    placeholder={t('Search order #, tracking #...', 'ابحث برقم الطلب أو التتبع...', isAr)}
                    value={codSearch}
                    onChange={(e) => {
                      setCodSearch(e.target.value);
                      setCodPage(1);
                    }}
                  />
                </div>
                <select
                  value={codStatus}
                  onChange={(e) => {
                    setCodStatus(e.target.value);
                    setCodPage(1);
                  }}
                  className="rounded border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-strong"
                >
                  <option value="">{t('All COD Statuses', 'كل حالات التحصيل', isAr)}</option>
                  <option value="pending">{t('Pending / Held', 'قيد التحصيل (معلّق)', isAr)}</option>
                  <option value="available">{t('Available (Credited)', 'متاح (تمت إضافته للرصيد)', isAr)}</option>
                  <option value="paid_out">{t('Paid Out', 'تم سحبه', isAr)}</option>
                  <option value="returned">{t('Returned', 'مرتجع', isAr)}</option>
                </select>
              </div>
              <span className="text-xs text-text-muted">
                {t(`Total: ${codData?.total ?? 0} COD shipments`, `الإجمالي: ${codData?.total ?? 0} شحنة تحصيل`, isAr)}
              </span>
            </div>
          </Card>

          <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm rtl:text-right">
                <thead className="border-b border-border-subtle bg-neutral-50 text-[11px] font-bold uppercase tracking-wider text-text-muted dark:bg-neutral-900/50">
                  <tr>
                    <th className="px-4 py-3">{t('Order #', 'رقم الطلب', isAr)}</th>
                    <th className="px-4 py-3 text-right rtl:text-left">{t('COD Amount', 'مبلغ التحصيل', isAr)}</th>
                    <th className="px-4 py-3 text-center">{t('Status', 'الحالة', isAr)}</th>
                    <th className="px-4 py-3">{t('Carrier Collection', 'تحصيل شركة الشحن', isAr)}</th>
                    <th className="px-4 py-3">{t('Remittance to EMDAD', 'التحويل لإمداد', isAr)}</th>
                    <th className="px-4 py-3 text-center">{t('Account Balance Status', 'حالة الرصيد', isAr)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {codLoading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center">
                        <Skeleton className="h-6 w-full" />
                      </td>
                    </tr>
                  ) : (codData?.items ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-text-muted">
                        {t('No COD records found.', 'لا توجد شحنات دفع عند الاستلام مطابقة.', isAr)}
                      </td>
                    </tr>
                  ) : (
                    codData!.items.map((row) => (
                      <tr key={row.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30">
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs font-semibold text-text-strong">
                            {row.omsOrder?.orderNumber ?? row.omsOrderId.slice(0, 8)}
                          </div>
                          {row.omsOrder?.trackingNumber ? (
                            <div className="text-[11px] text-text-muted">
                              AWB: {row.omsOrder.trackingNumber}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right rtl:text-left font-bold tabular-nums text-text-strong">
                          ${Number(row.currentAmount).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge
                            tone={
                              row.status === 'available'
                                ? 'success'
                                : row.status === 'pending'
                                  ? 'warning'
                                  : row.status === 'returned'
                                    ? 'danger'
                                    : 'neutral'
                            }
                          >
                            {row.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {row.carrierCollectedAt ? (
                            <span className="font-medium text-emerald-600 dark:text-emerald-400">
                              ✓ {t('Collected', 'تم التحصيل', isAr)} ({new Date(row.carrierCollectedAt).toLocaleDateString()})
                            </span>
                          ) : (
                            <span className="text-text-muted">{t('In transit / Pending', 'قيد التوصيل والتحصيل', isAr)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {row.carrierRemittedAt ? (
                            <span className="font-medium text-emerald-600 dark:text-emerald-400">
                              ✓ {t('Remitted', 'تم التحويل لإمداد', isAr)} ({new Date(row.carrierRemittedAt).toLocaleDateString()})
                            </span>
                          ) : (
                            <span className="text-text-muted">{t('Pending carrier payout', 'بانتظار تحويل شركة الشحن', isAr)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-xs">
                          {row.creditedToAccountAt ? (
                            <Badge tone="success">{t('Credited Available', 'متاح في الرصيد', isAr)}</Badge>
                          ) : (
                            <Badge tone="warning">{t('Held in Pending', 'معلّق قيد التحصيل', isAr)}</Badge>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {codData && codData.totalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-border-subtle px-4 py-3">
                <button
                  disabled={codPage <= 1}
                  onClick={() => setCodPage((p) => Math.max(1, p - 1))}
                  className="rounded px-3 py-1 text-xs font-semibold text-text-strong hover:bg-neutral-100 disabled:opacity-40"
                >
                  {t('Previous', 'السابق', isAr)}
                </button>
                <span className="text-xs text-text-muted">
                  {t(`Page ${codPage} of ${codData.totalPages}`, `صفحة ${codPage} من ${codData.totalPages}`, isAr)}
                </span>
                <button
                  disabled={codPage >= codData.totalPages}
                  onClick={() => setCodPage((p) => Math.min(codData.totalPages, p + 1))}
                  className="rounded px-3 py-1 text-xs font-semibold text-text-strong hover:bg-neutral-100 disabled:opacity-40"
                >
                  {t('Next', 'التالي', isAr)}
                </button>
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}

      {/* Request Payout Modal */}
      <Modal
        open={payoutModalOpen}
        onClose={() => setPayoutModalOpen(false)}
        title={t('Request Balance Payout', 'طلب سحب رصيد مالي', isAr)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setPayoutModalOpen(false)}>
              {t('Cancel', 'إلغاء', isAr)}
            </Button>
            <Button
              variant="primary"
              disabled={payoutMut.isPending}
              onClick={handleSubmitPayout}
            >
              {payoutMut.isPending
                ? t('Submitting...', 'جاري التقديم...', isAr)
                : t('Confirm Withdrawal Request', 'تأكيد طلب السحب', isAr)}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmitPayout} className="space-y-4">
          {payoutError ? <Alert variant="error">{payoutError}</Alert> : null}

          <div className="rounded-lg border border-border-subtle bg-neutral-50 p-3 text-xs text-text-muted dark:bg-neutral-900/40">
            <p>
              {t('Available for withdrawal:', 'الرصيد المتاح للسحب حالياً:', isAr)}{' '}
              <strong className="text-emerald-600 dark:text-emerald-400 tabular-nums font-bold">
                ${Number(account?.availableBalance ?? 0).toFixed(2)}
              </strong>
            </p>
            <p className="mt-1">
              {t(
                'Requested funds will be locked immediately and disbursed via bank transfer after Admin approval.',
                'سيتم حجز المبلغ المطلوب فوراً وصرفه عبر تحويل بنكي بعد اعتماد الإدارة.',
                isAr,
              )}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-text-strong">
              {t('Payout Amount (USD)', 'مبلغ السحب (دولار أمريكي)', isAr)} *
            </label>
            <Input
              type="number"
              step="0.01"
              min="1"
              max={Number(account?.availableBalance ?? 0)}
              placeholder="0.00"
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-text-strong">
                {t('Bank Name', 'اسم البنك', isAr)}
              </label>
              <Input
                placeholder={t('e.g. Commercial Bank of Syria', 'مثلاً: المصرف التجاري السوري', isAr)}
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-text-strong">
                {t('Account Number', 'رقم الحساب', isAr)}
              </label>
              <Input
                placeholder="e.g. 0101-123456"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-text-strong">
              {t('IBAN (optional)', 'رقم الآيبان الدولي (اختياري)', isAr)}
            </label>
            <Input
              placeholder="SY..."
              value={iban}
              onChange={(e) => setIban(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-text-strong">
              {t('Notes or Instructions (optional)', 'ملاحظات أو تعليمات خاصة (اختياري)', isAr)}
            </label>
            <Input
              placeholder={t('e.g. Send to Damascus branch', 'مثلاً: الاستلام من فرع دمشق', isAr)}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default ClientFinancesPage;
