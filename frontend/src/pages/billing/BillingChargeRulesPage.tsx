import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { BillingApi, type BillingChargeKind, type BillingChargeRule } from '../../api/billing';
import { CompaniesApi } from '../../api/companies';
import { AdminListPageShell } from '../../components/AdminListPageShell';
import { Button } from '../../components/Button';
import { Combobox } from '../../components/Combobox';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/ToastProvider';
import { QK } from '../../constants/query-keys';

const LABEL: Record<BillingChargeKind, { title: string; hint: string }> = {
  inbound_order: { title: 'Inbound orders', hint: 'Charged when the inbound order is completed.' },
  outbound_order: { title: 'Outbound orders', hint: 'Charged when the outbound order leaves the warehouse.' },
  oms_order: { title: 'Online (OMS) orders', hint: 'Charged when the order is dispatched.' },
  shipping_fee: { title: 'Shipping fee (EMDAD tariff)', hint: 'The client shipping rate, charged if not already deducted at dispatch.' },
  storage: { title: 'Storage space', hint: 'Flat fee per 30 days, pro-rated by the days in the invoice period.' },
};

const ORDER: BillingChargeKind[] = ['inbound_order', 'outbound_order', 'oms_order', 'shipping_fee', 'storage'];

export function BillingChargeRulesPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [companyId, setCompanyId] = useState('');
  const [rules, setRules] = useState<BillingChargeRule[]>([]);

  const companies = useQuery({ queryKey: QK.companies, queryFn: () => CompaniesApi.list({ includeAll: true }) });
  const loaded = useQuery({
    queryKey: ['billing', 'charge-rules', companyId],
    queryFn: () => BillingApi.getChargeRules(companyId),
    enabled: !!companyId,
  });
  useEffect(() => {
    if (loaded.data) setRules(ORDER.map((k) => loaded.data.find((r) => r.kind === k)!).filter(Boolean));
  }, [loaded.data]);

  const save = useMutation({
    mutationFn: () => BillingApi.saveChargeRules(companyId, rules),
    onSuccess: () => {
      toast.success('Charge rules saved.');
      void qc.invalidateQueries({ queryKey: ['billing', 'charge-rules', companyId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const patch = (kind: BillingChargeKind, change: Partial<BillingChargeRule>) =>
    setRules((prev) => prev.map((r) => (r.kind === kind ? { ...r, ...change } : r)));
  const num = (v: string) => (v === '' ? 0 : Number(v));

  return (
    <AdminListPageShell
      icon="fa-file-invoice"
      title="Charge rules"
      subtitle="Choose what each client is charged for and how the fee grows with lines and weight."
    >
      <div className="max-w-md">
        <Combobox
          label="Client"
          value={companyId}
          onChange={setCompanyId}
          options={(companies.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
          placeholder="Select client"
        />
      </div>

      {companyId && rules.length > 0 ? (
        <div className="space-y-4">
          {rules.map((r) => (
            <section key={r.kind} className="space-y-3 rounded-xl border border-border bg-surface-card p-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={r.enabled}
                  onChange={(e) => patch(r.kind, { enabled: e.target.checked })}
                />
                <span>
                  <span className="block text-sm font-semibold text-text-strong">{LABEL[r.kind].title}</span>
                  <span className="block text-xs text-text-muted">{LABEL[r.kind].hint}</span>
                </span>
              </label>
              {r.enabled && r.kind !== 'shipping_fee' ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <TextField
                    label={r.kind === 'storage' ? 'Fee per 30 days (USD)' : 'Base fee per order (USD)'}
                    type="number"
                    min={0}
                    step="0.01"
                    value={String(r.baseFee)}
                    onChange={(e) => patch(r.kind, { baseFee: num(e.target.value) })}
                  />
                  {r.kind !== 'storage' ? (
                    <>
                      <TextField
                        label="Lines included"
                        type="number"
                        min={0}
                        step="1"
                        value={String(r.includedLines)}
                        onChange={(e) => patch(r.kind, { includedLines: Math.floor(num(e.target.value)) })}
                      />
                      <TextField
                        label="Fee per extra line (USD)"
                        type="number"
                        min={0}
                        step="0.01"
                        value={String(r.extraLineFee)}
                        onChange={(e) => patch(r.kind, { extraLineFee: num(e.target.value) })}
                      />
                      <TextField
                        label="Weight included (kg)"
                        type="number"
                        min={0}
                        step="0.1"
                        value={String(r.includedWeightKg)}
                        onChange={(e) => patch(r.kind, { includedWeightKg: num(e.target.value) })}
                      />
                      <TextField
                        label="Fee per extra kg (USD)"
                        type="number"
                        min={0}
                        step="0.01"
                        value={String(r.extraKgFee)}
                        onChange={(e) => patch(r.kind, { extraKgFee: num(e.target.value) })}
                      />
                    </>
                  ) : null}
                </div>
              ) : null}
            </section>
          ))}
          <Button type="button" loading={save.isPending} onClick={() => save.mutate()}>
            Save charge rules
          </Button>
        </div>
      ) : null}
    </AdminListPageShell>
  );
}
