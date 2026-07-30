import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  BillingApi,
  type BillingPlanType,
  type CreateBillingPlanPayload,
} from '../../api/billing';
import { Button } from '../../components/Button';
import { Combobox } from '../../components/Combobox';
import { PageHeader } from '../../components/PageHeader';
import { SelectField } from '../../components/SelectField';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/ToastProvider';
import { QK } from '../../constants/query-keys';
import { useAuth } from '../../auth/AuthContext';

const CURRENCY = 'SYP';

function numField(v: string): number {
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : 0;
}

export function BillingPlanCreatePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const canMutate = user?.role === 'super_admin' || user?.role === 'wh_manager';

  const [companyId, setCompanyId] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [planType, setPlanType] = useState<BillingPlanType>('custom');
  const [templateId, setTemplateId] = useState('');
  const [reservedVolume, setReservedVolume] = useState('0');
  const [fixedSubscriptionFee, setFixedSubscriptionFee] = useState('0');
  const [cycleLengthDays, setCycleLengthDays] = useState('30');

  const companiesQuery = useQuery({
    queryKey: [...QK.billing.companiesWithoutPlan, clientSearch],
    queryFn: () => BillingApi.listCompaniesWithoutPlan(clientSearch),
    enabled: canMutate,
  });

  const templatesQuery = useQuery({
    queryKey: [...QK.billing.templates, 'active'],
    queryFn: () => BillingApi.listTemplates({ activeOnly: true }),
    enabled: canMutate,
  });

  const selectedTemplate = useMemo(
    () => (templatesQuery.data ?? []).find((t) => t.id === templateId) ?? null,
    [templatesQuery.data, templateId],
  );

  useEffect(() => {
    if (planType !== 'template' || !selectedTemplate) return;
    setReservedVolume(selectedTemplate.reservedVolume);
    setFixedSubscriptionFee(selectedTemplate.fixedSubscriptionFee);
    setCycleLengthDays(String(selectedTemplate.cycleLengthDays));
  }, [planType, selectedTemplate]);

  const createMut = useMutation({
    mutationFn: (payload: CreateBillingPlanPayload) => BillingApi.createPlan(payload),
    onSuccess: (plan) => {
      toast.success('Billing plan created.');
      void qc.invalidateQueries({ queryKey: QK.billing.plans });
      void qc.invalidateQueries({ queryKey: QK.billing.companiesWithoutPlan });
      void qc.invalidateQueries({ queryKey: QK.billing.capacity });
      navigate(`/billing/plans/${plan.companyId}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const fieldsReadOnly = planType === 'template';

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!companyId) {
      toast.error('Select a client.');
      return;
    }
    if (planType === 'template' && !templateId) {
      toast.error('Select a plan template.');
      return;
    }
    const cycleDays = Math.max(1, Math.floor(numField(cycleLengthDays)) || 30);
    const payload: CreateBillingPlanPayload = {
      companyId,
      planType,
      cycleLengthDays: cycleDays,
      reservedVolume: numField(reservedVolume),
      fixedSubscriptionFee: numField(fixedSubscriptionFee),
    };
    if (planType === 'template') {
      payload.templateId = templateId;
    }
    createMut.mutate(payload);
  };

  if (!canMutate) {
    return (
      <div className="space-y-4">
        <Link to="/billing/plans" className="text-sm text-slate-500 hover:underline">
          ← Back to billing plans
        </Link>
        <p className="text-sm text-rose-600">You do not have permission to create billing plans.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-500">
        <Link to="/billing/plans" className="hover:underline">
          ← Back to billing plans
        </Link>
      </div>

      <PageHeader
        title="Create billing plan"
        description="Assign a custom or template-based subscription plan to a client without an active plan."
      />

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Combobox
              label="Client"
              value={companyId}
              onChange={setCompanyId}
              onSearchQueryChange={setClientSearch}
              options={(companiesQuery.data ?? []).map((c) => ({
                value: c.id,
                label: c.name,
                hint: c.status,
              }))}
              placeholder="Search clients without a plan…"
              emptyMessage="No clients without an active plan"
              required
            />
          </div>

          <SelectField
            label="Plan mode"
            value={planType}
            onChange={(e) => {
              const next = e.target.value as BillingPlanType;
              setPlanType(next);
              if (next === 'custom') setTemplateId('');
            }}
            options={[
              { value: 'custom', label: 'Custom' },
              { value: 'template', label: 'Template' },
            ]}
          />

          {planType === 'template' ? (
            <Combobox
              label="Template"
              value={templateId}
              onChange={setTemplateId}
              options={(templatesQuery.data ?? []).map((t) => ({
                value: t.id,
                label: t.name,
                hint: `${t.reservedVolume} m³ · ${t.fixedSubscriptionFee} ${CURRENCY} · ${t.cycleLengthDays}d`,
              }))}
              placeholder="Select template…"
              emptyMessage="No active templates"
              required
            />
          ) : (
            <div />
          )}

          <TextField
            label="Reserved volume (m³)"
            type="number"
            min={0}
            step="0.01"
            value={reservedVolume}
            onChange={(e) => setReservedVolume(e.target.value)}
            disabled={fieldsReadOnly}
            required
          />
          <TextField
            label={`Subscription price (${CURRENCY})`}
            type="number"
            min={0}
            step="0.01"
            value={fixedSubscriptionFee}
            onChange={(e) => setFixedSubscriptionFee(e.target.value)}
            disabled={fieldsReadOnly}
            required
          />
          <TextField
            label="Billing cycle (days)"
            type="number"
            min={1}
            step="1"
            value={cycleLengthDays}
            onChange={(e) => setCycleLengthDays(e.target.value)}
            disabled={fieldsReadOnly}
            required
          />
        </div>

        {planType === 'template' ? (
          <p className="text-xs text-slate-500">
            Template fields are read-only. Switch to Custom to edit volume, price, or cycle length.
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/billing/plans')}
            disabled={createMut.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" variant="brand" loading={createMut.isPending}>
            Create plan
          </Button>
        </div>
      </form>
    </div>
  );
}
