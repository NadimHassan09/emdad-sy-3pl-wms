import { PillSubNav } from '../PillSubNav';

const FINANCE_TABS = [
  { key: 'overview', label: 'Overview', labelAr: 'نظرة عامة', to: '/finance/overview' },
  { key: 'accounts', label: 'Client Accounts', labelAr: 'حسابات العملاء', to: '/finance/accounts' },
  { key: 'transactions', label: 'Transactions', labelAr: 'الحركات المالية', to: '/finance/transactions' },
  { key: 'cod', label: 'COD Management', labelAr: 'إدارة الدفع عند الاستلام', to: '/finance/cod' },
  { key: 'payouts', label: 'Payouts', labelAr: 'المسحوبات', to: '/finance/payouts' },
  { key: 'carrier-costs', label: 'Carrier Costs', labelAr: 'تكاليف شركات الشحن', to: '/finance/carrier-costs' },
  { key: 'policies', label: 'Policies', labelAr: 'السياسات المالية', to: '/finance/policies' },
  { key: 'legacy-billing', label: 'Legacy Billing', labelAr: 'الفوترة السابقة (أرشيف)', to: '/billing/invoices' },
];

export function FinanceNav({ actions }: { actions?: React.ReactNode }) {

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <PillSubNav
          ariaLabel="Financial Management navigation"
          className="mb-0"
          items={FINANCE_TABS.map((tab) => ({
            key: tab.key,
            label: tab.label,
            to: tab.to,
          }))}
        />
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
