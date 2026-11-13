import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Badge, Button, Card, Input, Skeleton } from '@ds';

import { AdminListPageShell } from '../../components/AdminListPageShell';
import { FinanceNav } from '../../components/finance/FinanceNav';
import { FinanceApi } from '../../api/finance';

export function FinancialSettingsPage() {
  const qc = useQueryClient();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: policies, isLoading, error } = useQuery({
    queryKey: ['finance', 'policies'],
    queryFn: () => FinanceApi.getPolicies(),
  });

  const updateMut = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      FinanceApi.updatePolicy(key, { value }),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['finance', 'policies'] });
      setSuccessMsg(`Policy "${data.key}" updated successfully.`);
      setErrorMsg(null);
      setTimeout(() => setSuccessMsg(null), 4000);
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message ?? err.message ?? 'Update failed');
      setSuccessMsg(null);
    },
  });

  const getPolicyValue = (key: string, fallback: string = '') => {
    return policies?.find((p) => p.key === key)?.value ?? fallback;
  };

  return (
    <AdminListPageShell
      icon="Settings"
      title="Financial Policies & Settings"
      subtitle="Modular business rules governing COD recognition, payout thresholds, and charge timing"
      showSectionNav={false}
    >
      <FinanceNav />

      {/* Principles Callout */}
      <Alert variant="info" className="mb-4">
        <strong>Architectural Rule:</strong> Policy updates take effect immediately for future financial events.
        Posted historical transactions are never silently rewritten.
      </Alert>

      {successMsg ? <Alert variant="success" className="mb-4">{successMsg}</Alert> : null}
      {errorMsg ? <Alert variant="error" className="mb-4">{errorMsg}</Alert> : null}
      {error ? <Alert variant="error" className="mb-4">Failed to load financial policies.</Alert> : null}

      {isLoading ? (
        <Card padding="md">
          <Skeleton className="h-40 w-full" />
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Policy 1: Cutover Active */}
          <Card padding="md">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-text-strong">Financial Management Cutover</h3>
                  <Badge tone={getPolicyValue('cutover_active') === 'true' ? 'success' : 'warning'}>
                    {getPolicyValue('cutover_active') === 'true' ? 'Active' : 'Disabled'}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  When active, the current-account system replaces legacy monthly billing cycles and prevents legacy cycle lockout.
                </p>
              </div>
              <Button
                variant={getPolicyValue('cutover_active') === 'true' ? 'secondary' : 'primary'}
                disabled={updateMut.isPending}
                onClick={() =>
                  updateMut.mutate({
                    key: 'cutover_active',
                    value: getPolicyValue('cutover_active') === 'true' ? 'false' : 'true',
                  })
                }
              >
                {getPolicyValue('cutover_active') === 'true' ? 'Deactivate Cutover' : 'Activate Cutover'}
              </Button>
            </div>
          </Card>

          {/* Policy 2: COD Available Eligibility */}
          <Card padding="md">
            <div>
              <h3 className="font-semibold text-text-strong">COD Balance Availability Policy</h3>
              <p className="mt-1 text-xs text-text-muted">
                Governs when collected COD cash is released from pending/held status into the client&apos;s withdrawable available balance.
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                {
                  key: 'on_remittance',
                  title: 'On Carrier Remittance (Conservative - Recommended)',
                  desc: 'Cash is credited to available balance only after EMDAD physically receives remittance from the carrier.',
                },
                {
                  key: 'on_collection',
                  title: 'On Collection Confirmation',
                  desc: 'Cash is credited when carrier confirms delivery collection, before EMDAD receives the physical remittance.',
                },
                {
                  key: 'on_delivered',
                  title: 'Immediately on Delivery',
                  desc: 'Cash is credited as soon as the OMS order status is marked Delivered.',
                },
              ].map((opt) => {
                const isSelected = getPolicyValue('cod_eligibility', 'on_remittance') === opt.key;
                return (
                  <div
                    key={opt.key}
                    onClick={() => updateMut.mutate({ key: 'cod_eligibility', value: opt.key })}
                    className={`cursor-pointer rounded-lg border p-4 transition-all ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/20'
                        : 'border-border-subtle hover:bg-neutral-50 dark:hover:bg-neutral-900/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-text-strong">{opt.title}</span>
                      {isSelected ? <Badge tone="brand">Active</Badge> : null}
                    </div>
                    <p className="mt-2 text-xs text-text-muted">{opt.desc}</p>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Policy 3: Shipping Fee Timing & Minimum Payout */}
          <div className="grid gap-6 sm:grid-cols-2">
            <Card padding="md">
              <h3 className="font-semibold text-text-strong">Shipping Fee Recognition Timing</h3>
              <p className="mt-1 text-xs text-text-muted">
                When the client&apos;s current account is debited for commercial shipping fees.
              </p>
              <div className="mt-3 flex gap-2">
                {[
                  { key: 'at_dispatch', label: 'At Dispatch / Shipment' },
                  { key: 'on_delivered', label: 'On Order Delivery' },
                ].map((opt) => {
                  const isSelected = getPolicyValue('shipping_fee_timing', 'at_dispatch') === opt.key;
                  return (
                    <Button
                      key={opt.key}
                      variant={isSelected ? 'primary' : 'secondary'}
                      disabled={updateMut.isPending}
                      onClick={() => updateMut.mutate({ key: 'shipping_fee_timing', value: opt.key })}
                    >
                      {opt.label}
                    </Button>
                  );
                })}
              </div>
            </Card>

            <Card padding="md">
              <h3 className="font-semibold text-text-strong">Minimum Payout Request Amount (USD)</h3>
              <p className="mt-1 text-xs text-text-muted">
                Smallest withdrawal amount a client is permitted to submit in the client portal.
              </p>
              <div className="mt-3 flex items-center gap-3">
                <Input
                  type="number"
                  step="1"
                  min="1"
                  className="w-32"
                  defaultValue={getPolicyValue('minimum_payout_amount', '10.00')}
                  onBlur={(e) => {
                    const val = e.target.value;
                    if (val && !isNaN(Number(val))) {
                      updateMut.mutate({ key: 'minimum_payout_amount', value: Number(val).toFixed(2) });
                    }
                  }}
                />
                <span className="text-xs text-text-muted">USD per request (auto-saves on blur)</span>
              </div>
            </Card>
          </div>

          {/* B12 — In-transit float / reconciliation / client shield */}
          <Card padding="md">
            <h3 className="font-semibold text-text-strong">B12 — In-transit float &amp; carrier reconciliation</h3>
            <p className="mt-1 text-xs text-text-muted">
              Admin toggles. Modules stay off until you enable them; client portal respects Client Shield.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {(
                [
                  ['in_transit_float_enabled', 'In-transit float'],
                  ['carrier_reconciliation_enabled', 'Carrier reconciliation'],
                  ['client_shield_enabled', 'Client shield (hide gaps from clients)'],
                ] as const
              ).map(([key, label]) => {
                const on = getPolicyValue(key, key === 'client_shield_enabled' ? 'true' : 'false') === 'true';
                return (
                  <div key={key} className="rounded-lg border border-border-subtle p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-text-strong">{label}</span>
                      <Badge tone={on ? 'success' : 'neutral'}>{on ? 'On' : 'Off'}</Badge>
                    </div>
                    <Button
                      className="mt-3"
                      variant={on ? 'secondary' : 'primary'}
                      disabled={updateMut.isPending}
                      onClick={() => updateMut.mutate({ key, value: on ? 'false' : 'true' })}
                    >
                      {on ? 'Turn off' : 'Turn on'}
                    </Button>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* B15 — Liquidity / prep fee (due moment is COD Balance Availability above) */}
          <Card padding="md">
            <h3 className="font-semibold text-text-strong">B15 — Liquidity gap &amp; prep fee</h3>
            <p className="mt-1 text-xs text-text-muted">
              COD due moment is controlled by &quot;COD Balance Availability Policy&quot; above. Choose how to bridge cash until remittance.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {(
                [
                  { key: 'none', title: 'None', desc: 'No liquidity bridge.' },
                  { key: 'float', title: 'Float', desc: 'Track in-transit float until remittance.' },
                  { key: 'prep_fee', title: 'Prep fee', desc: 'Charge a prep fee while COD is outstanding.' },
                ] as const
              ).map((opt) => {
                const isSelected = getPolicyValue('liquidity_gap_mode', 'none') === opt.key;
                return (
                  <div
                    key={opt.key}
                    onClick={() => updateMut.mutate({ key: 'liquidity_gap_mode', value: opt.key })}
                    className={`cursor-pointer rounded-lg border p-4 transition-all ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/20'
                        : 'border-border-subtle hover:bg-neutral-50 dark:hover:bg-neutral-900/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-text-strong">{opt.title}</span>
                      {isSelected ? <Badge tone="brand">Active</Badge> : null}
                    </div>
                    <p className="mt-2 text-xs text-text-muted">{opt.desc}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-4">
              <div>
                <p className="text-xs font-semibold text-text-strong">Prep fee enabled</p>
                <Button
                  className="mt-2"
                  variant={getPolicyValue('prep_fee_enabled') === 'true' ? 'secondary' : 'primary'}
                  disabled={updateMut.isPending}
                  onClick={() =>
                    updateMut.mutate({
                      key: 'prep_fee_enabled',
                      value: getPolicyValue('prep_fee_enabled') === 'true' ? 'false' : 'true',
                    })
                  }
                >
                  {getPolicyValue('prep_fee_enabled') === 'true' ? 'Disable prep fee' : 'Enable prep fee'}
                </Button>
              </div>
              <div>
                <p className="text-xs font-semibold text-text-strong">Prep fee %</p>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  className="mt-2 w-28"
                  defaultValue={getPolicyValue('prep_fee_percent', '0')}
                  onBlur={(e) => {
                    const val = e.target.value;
                    if (val !== '' && !isNaN(Number(val))) {
                      updateMut.mutate({ key: 'prep_fee_percent', value: String(Number(val)) });
                    }
                  }}
                />
              </div>
            </div>
          </Card>
        </div>
      )}
    </AdminListPageShell>
  );
}

export default FinancialSettingsPage;
