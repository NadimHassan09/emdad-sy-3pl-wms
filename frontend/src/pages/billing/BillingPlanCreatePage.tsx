import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  BillingApi,
  type BillingPlanType,
  type CreateBillingPlanPayload,
} from '../../api/billing';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/Button';
import { Combobox } from '../../components/Combobox';
import { SelectField } from '../../components/SelectField';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/ToastProvider';
import { QK } from '../../constants/query-keys';
import { Alert, AppPageHeader, Breadcrumb, Card } from '@ds';

const CURRENCY = 'USD';
const FORM_ID = 'billing-plan-create-form';

function numField(v: string): number {
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : 0;
}

function FormSection({
  title,
  description,
  children,
  bordered = true,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  bordered?: boolean;
}) {
  return (
    <div
      className={
        bordered
          ? 'grid gap-6 border-b border-border-subtle pb-6 last:border-b-0 last:pb-0 lg:grid-cols-[minmax(200px,240px)_1fr]'
          : 'grid gap-6 lg:grid-cols-[minmax(200px,240px)_1fr]'
      }
    >
      <div>
        <h2 className="text-sm font-semibold text-text-strong">{title}</h2>
        {description ? <p className="mt-1 text-xs text-text-muted">{description}</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
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
        <Breadcrumb
          items={[
            { label: 'Billing plans', href: '/billing/plans' },
            { label: 'Create plan' },
          ]}
        />
        <Alert variant="error" title="You do not have permission to create billing plans." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-sticky -mx-3 border-b border-border bg-[var(--surface-page)]/95 px-3 py-3 backdrop-blur-sm sm:-mx-4 sm:px-4">
        <Breadcrumb
          className="mb-3"
          items={[
            { label: 'Billing plans', href: '/billing/plans' },
            { label: 'Create plan' },
          ]}
        />
        <AppPageHeader
          title="Create billing plan"
          description="Assign a custom or template-based subscription plan to a client without an active plan."
          actions={
            <>
              <Button
                type="button"
                variant="danger"
                onClick={() => navigate('/billing/plans')}
                disabled={createMut.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form={FORM_ID}
                variant="brand"
                loading={createMut.isPending}
              >
                Create plan
              </Button>
            </>
          }
        />
      </div>

      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4">
        <Card padding="none" elevation="flat">
          <Card.Body className="space-y-6">
            <FormSection
              title="Client & plan mode"
              description="Choose the client and whether this plan follows a template or custom terms."
            >
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
            </FormSection>

            <FormSection
              title="Billing terms"
              description={
                planType === 'template'
                  ? 'Template fields are read-only. Switch to Custom to edit volume, price, or cycle length.'
                  : 'Set reserved storage volume, subscription price, and billing cycle length.'
              }
              bordered={false}
            >
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
            </FormSection>
          </Card.Body>
        </Card>
      </form>
    </div>
  );
}
