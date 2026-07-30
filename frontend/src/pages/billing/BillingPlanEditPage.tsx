import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  BillingApi,
  type BillingApplyMode,
  type BillingPlanType,
  type UpdateBillingPlanPayload,
} from '../../api/billing';
import { Button } from '../../components/Button';
import { Combobox } from '../../components/Combobox';
import { Modal } from '../../components/Modal';
import { PageHeader } from '../../components/PageHeader';
import { SelectField } from '../../components/SelectField';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/ToastProvider';
import { QK } from '../../constants/query-keys';
import { useAuth } from '../../auth/AuthContext';
import { MODAL_CANCEL_BUTTON_CLASS } from '../../lib/modal-button-styles';

const CURRENCY = 'SYP';

function numField(v: string): number {
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : 0;
}

export function BillingPlanEditPage() {
  const { clientId = '' } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const canMutate = user?.role === 'super_admin' || user?.role === 'wh_manager';

  const [planType, setPlanType] = useState<BillingPlanType>('custom');
  const [templateId, setTemplateId] = useState('');
  const [reservedVolume, setReservedVolume] = useState('0');
  const [fixedSubscriptionFee, setFixedSubscriptionFee] = useState('0');
  const [cycleLengthDays, setCycleLengthDays] = useState('30');
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<UpdateBillingPlanPayload | null>(null);

  const detailQuery = useQuery({
    queryKey: QK.billing.planDetail(clientId),
    queryFn: () => BillingApi.getPlanDetailByClient(clientId),
    enabled: !!clientId && canMutate,
  });

  const templatesQuery = useQuery({
    queryKey: [...QK.billing.templates, 'active'],
    queryFn: () => BillingApi.listTemplates({ activeOnly: true }),
    enabled: canMutate,
  });

  const plan = detailQuery.data?.plan ?? null;
  const company = detailQuery.data?.company;

  useEffect(() => {
    if (!plan) return;
    setPlanType(plan.planType === 'template' ? 'template' : 'custom');
    setTemplateId(plan.templateId ?? '');
    setReservedVolume(plan.reservedVolume);
    setFixedSubscriptionFee(plan.fixedSubscriptionFee);
    setCycleLengthDays(String(plan.cycleLengthDays));
  }, [plan]);

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

  const updateMut = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateBillingPlanPayload;
    }) => BillingApi.updatePlan(id, payload),
    onSuccess: () => {
      toast.success('Billing plan updated.');
      setApplyModalOpen(false);
      setPendingPayload(null);
      void qc.invalidateQueries({ queryKey: QK.billing.plans });
      void qc.invalidateQueries({ queryKey: QK.billing.planDetail(clientId) });
      void qc.invalidateQueries({ queryKey: QK.billing.capacity });
      navigate(`/billing/plans/${clientId}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const fieldsReadOnly = planType === 'template';

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!plan) return;
    if (planType === 'template' && !templateId) {
      toast.error('Select a plan template.');
      return;
    }
    const payload: UpdateBillingPlanPayload = {
      planType,
      templateId: planType === 'template' ? templateId : null,
      reservedVolume: numField(reservedVolume),
      fixedSubscriptionFee: numField(fixedSubscriptionFee),
      cycleLengthDays: Math.max(1, Math.floor(numField(cycleLengthDays)) || 30),
    };
    setPendingPayload(payload);
    setApplyModalOpen(true);
  };

  const applyWithMode = (applyMode: BillingApplyMode) => {
    if (!plan || !pendingPayload) return;
    updateMut.mutate({ id: plan.id, payload: { ...pendingPayload, applyMode } });
  };

  if (!canMutate) {
    return (
      <div className="space-y-4">
        <Link to={`/billing/plans/${clientId}`} className="text-sm text-slate-500 hover:underline">
          ← Back to plan
        </Link>
        <p className="text-sm text-rose-600">You do not have permission to edit billing plans.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-500">
        <Link to={`/billing/plans/${clientId}`} className="hover:underline">
          ← Back to plan
        </Link>
      </div>

      <PageHeader
        title={company ? `Edit plan — ${company.name}` : 'Edit billing plan'}
        description="Update reserved volume, subscription price, and billing cycle."
      />

      {detailQuery.isPending ? <p className="text-sm text-slate-500">Loading plan…</p> : null}
      {detailQuery.isError ? (
        <p className="text-sm text-rose-600">Could not load billing plan.</p>
      ) : null}
      {!plan && !detailQuery.isPending ? (
        <p className="text-sm text-slate-600">This client has no active billing plan to edit.</p>
      ) : null}

      {plan ? (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="grid gap-4 sm:grid-cols-2">
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
              Template fields are read-only. Switch to Custom to override volume, price, or cycle.
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(`/billing/plans/${clientId}`)}
              disabled={updateMut.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" variant="brand" disabled={updateMut.isPending}>
              Save changes
            </Button>
          </div>
        </form>
      ) : null}

      <Modal
        open={applyModalOpen}
        onClose={() => {
          if (updateMut.isPending) return;
          setApplyModalOpen(false);
          setPendingPayload(null);
        }}
        title="When should this change take effect?"
        widthClass="max-w-md"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              className={MODAL_CANCEL_BUTTON_CLASS}
              disabled={updateMut.isPending}
              onClick={() => {
                setApplyModalOpen(false);
                setPendingPayload(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={updateMut.isPending}
              onClick={() => applyWithMode('next_cycle')}
            >
              Apply starting next cycle
            </Button>
            <Button
              type="button"
              variant="brand"
              loading={updateMut.isPending}
              onClick={() => applyWithMode('immediate')}
            >
              Apply immediately
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Immediate changes update the active plan (and may affect the current cycle invoice). Next-cycle
          changes are stored as pending and applied when the billing cycle renews.
        </p>
      </Modal>
    </div>
  );
}
