import { FormEvent, useEffect, useState } from 'react';

import type { BillingPlanRow, CreateBillingPlanPayload, UpdateBillingPlanPayload } from '../../api/billing';
import { Button } from '../Button';
import { Combobox } from '../Combobox';
import { Modal } from '../Modal';
import { TextField } from '../TextField';
import { MODAL_CANCEL_BUTTON_CLASS } from '../../lib/modal-button-styles';
import { companyFilterComboboxOptions } from '../../lib/company-filter-options';

type Mode = 'create' | 'edit';

type Props = {
  open: boolean;
  mode: Mode;
  companies: { id: string; name: string }[];
  initialCompanyId?: string;
  plan?: BillingPlanRow | null;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateBillingPlanPayload | UpdateBillingPlanPayload) => void;
};

const emptyCreate = (companyId = ''): CreateBillingPlanPayload => ({
  companyId,
  cycleLengthDays: 30,
  fixedSubscriptionFee: 0,
  inboundOrderFee: 0,
  outboundOrderFee: 0,
  packagingFee: 0,
  qualityCheckFee: 0,
  excessVolumeFeePerDay: 0,
  excessWeightFeePerDay: 0,
  reservedVolume: 0,
  reservedWeight: 0,
});

function numField(v: string): number | undefined {
  const t = v.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

export function BillingPlanFormModal({
  open,
  mode,
  companies,
  initialCompanyId,
  plan,
  saving,
  onClose,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<CreateBillingPlanPayload>(() =>
    emptyCreate(initialCompanyId ?? ''),
  );

  useEffect(() => {
    if (!open) return;
    if (mode === 'create') {
      setForm(emptyCreate(initialCompanyId ?? ''));
      return;
    }
    if (!plan) return;
    setForm({
      companyId: plan.companyId,
      active: plan.active,
      cycleLengthDays: plan.cycleLengthDays,
      fixedSubscriptionFee: Number(plan.fixedSubscriptionFee),
      inboundOrderFee: Number(plan.inboundOrderFee),
      outboundOrderFee: Number(plan.outboundOrderFee),
      packagingFee: Number(plan.packagingFee),
      qualityCheckFee: Number(plan.qualityCheckFee),
      excessVolumeFeePerDay: Number(plan.excessVolumeFeePerDay),
      excessWeightFeePerDay: Number(plan.excessWeightFeePerDay),
      reservedVolume: Number(plan.reservedVolume),
      reservedWeight: Number(plan.reservedWeight),
    });
  }, [open, mode, plan, initialCompanyId]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'create') {
      onSubmit({
        ...form,
        companyId: form.companyId.trim(),
        cycleLengthDays: form.cycleLengthDays,
      });
      return;
    }
    const { companyId: _c, cycleStartsAt: _s, ...update } = form;
    onSubmit(update);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Create billing plan' : 'Edit billing plan'}
      widthClass="max-w-2xl"
      footer={
        <>
          <Button type="button" variant="secondary" className={MODAL_CANCEL_BUTTON_CLASS} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="billing-plan-form" variant="brand" disabled={saving}>
            {saving ? 'Saving…' : mode === 'create' ? 'Create plan' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id="billing-plan-form" className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
        {mode === 'create' ? (
          <div className="sm:col-span-2">
            <Combobox
              label="Client"
              value={form.companyId}
              onChange={(v) => setForm((f) => ({ ...f, companyId: v }))}
              options={companyFilterComboboxOptions(companies, 'Select client…').filter((o) => o.value !== '')}
              required
            />
          </div>
        ) : null}

        <TextField
          label="Cycle length (days)"
          type="number"
          min={1}
          value={String(form.cycleLengthDays)}
          onChange={(e) => setForm((f) => ({ ...f, cycleLengthDays: Number(e.target.value) || 1 }))}
          required
        />
        <TextField
          label="Fixed subscription fee"
          type="number"
          min={0}
          step="0.01"
          value={String(form.fixedSubscriptionFee ?? '')}
          onChange={(e) => setForm((f) => ({ ...f, fixedSubscriptionFee: numField(e.target.value) ?? 0 }))}
        />
        <TextField
          label="Inbound order fee"
          type="number"
          min={0}
          step="0.0001"
          value={String(form.inboundOrderFee ?? '')}
          onChange={(e) => setForm((f) => ({ ...f, inboundOrderFee: numField(e.target.value) ?? 0 }))}
        />
        <TextField
          label="Outbound order fee"
          type="number"
          min={0}
          step="0.0001"
          value={String(form.outboundOrderFee ?? '')}
          onChange={(e) => setForm((f) => ({ ...f, outboundOrderFee: numField(e.target.value) ?? 0 }))}
        />
        <TextField
          label="Packaging fee"
          type="number"
          min={0}
          step="0.0001"
          value={String(form.packagingFee ?? '')}
          onChange={(e) => setForm((f) => ({ ...f, packagingFee: numField(e.target.value) ?? 0 }))}
        />
        <TextField
          label="Quality check fee"
          type="number"
          min={0}
          step="0.0001"
          value={String(form.qualityCheckFee ?? '')}
          onChange={(e) => setForm((f) => ({ ...f, qualityCheckFee: numField(e.target.value) ?? 0 }))}
        />
        <TextField
          label="Excess volume fee / day"
          type="number"
          min={0}
          step="0.0001"
          value={String(form.excessVolumeFeePerDay ?? '')}
          onChange={(e) => setForm((f) => ({ ...f, excessVolumeFeePerDay: numField(e.target.value) ?? 0 }))}
        />
        <TextField
          label="Excess weight fee / day"
          type="number"
          min={0}
          step="0.0001"
          value={String(form.excessWeightFeePerDay ?? '')}
          onChange={(e) => setForm((f) => ({ ...f, excessWeightFeePerDay: numField(e.target.value) ?? 0 }))}
        />
        <TextField
          label="Reserved volume (CBM)"
          type="number"
          min={0}
          step="0.0001"
          value={String(form.reservedVolume ?? '')}
          onChange={(e) => setForm((f) => ({ ...f, reservedVolume: numField(e.target.value) ?? 0 }))}
        />
        <TextField
          label="Reserved weight (kg)"
          type="number"
          min={0}
          step="0.0001"
          value={String(form.reservedWeight ?? '')}
          onChange={(e) => setForm((f) => ({ ...f, reservedWeight: numField(e.target.value) ?? 0 }))}
        />

        {mode === 'edit' ? (
          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.active ?? true}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
            <span className="text-sm text-slate-700">Plan active</span>
          </label>
        ) : null}

        {mode === 'edit' ? (
          <p className="sm:col-span-2 text-xs text-slate-500">
            Rate changes apply to future billing cycles only. The current cycle invoice uses snapshotted rates.
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
