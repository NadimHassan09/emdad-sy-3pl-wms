import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { BillingApi, type CreateManualInvoiceLinePayload } from '../../api/billing';
import { Button } from '../Button';
import { Combobox } from '../Combobox';
import { Modal } from '../Modal';
import { TextField } from '../TextField';
import { useToast } from '../ToastProvider';
import { QK } from '../../constants/query-keys';
import { companyFilterComboboxOptions } from '../../lib/company-filter-options';

type Props = {
  open: boolean;
  companies: { id: string; name: string }[];
  onClose: () => void;
};

type LineDraft = CreateManualInvoiceLinePayload & { key: string };

const emptyLine = (): LineDraft => ({
  key: crypto.randomUUID(),
  description: '',
  quantity: 1,
  unitPrice: 0,
});

export function CreateAdHocInvoiceModal({ open, companies, onClose }: Props) {
  const toast = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [companyId, setCompanyId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);

  const createMut = useMutation({
    mutationFn: () =>
      BillingApi.createAdHocInvoice({
        companyId,
        invoiceDate,
        dueDate,
        lines: lines.map(({ description, quantity, unitPrice }) => ({
          description: description.trim(),
          quantity,
          unitPrice,
        })),
      }),
    onSuccess: (invoice) => {
      void qc.invalidateQueries({ queryKey: QK.billing.invoices });
      toast.success('Ad-hoc invoice created.');
      onClose();
      navigate(`/billing/invoices/${invoice.id}`);
    },
    onError: () => toast.error('Could not create invoice.'),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!companyId) {
      toast.error('Select a client.');
      return;
    }
    if (lines.some((l) => !l.description.trim())) {
      toast.error('Every line needs a description.');
      return;
    }
    createMut.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create ad-hoc invoice"
      widthClass="max-w-3xl"
      footer={
        <>
          <Button type="button" variant="danger" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="ad-hoc-invoice-form" variant="brand" loading={createMut.isPending}>
            Create draft invoice
          </Button>
        </>
      }
    >
      <form id="ad-hoc-invoice-form" className="space-y-4" onSubmit={handleSubmit}>
        <Combobox
          label="Client"
          value={companyId}
          onChange={setCompanyId}
          options={companyFilterComboboxOptions(companies, 'Select client…').filter((o) => o.value !== '')}
          required
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Invoice date"
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            required
          />
          <TextField
            label="Due date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-text-strong">Invoice lines</h4>
            <Button type="button" size="sm" variant="secondary" onClick={() => setLines((l) => [...l, emptyLine()])}>
              Add line
            </Button>
          </div>
          {lines.map((line, idx) => (
            <div key={line.key} className="grid gap-2 rounded border border-border p-3 sm:grid-cols-4">
              <TextField
                label={idx === 0 ? 'Description' : undefined}
                value={line.description}
                onChange={(e) =>
                  setLines((rows) =>
                    rows.map((r) => (r.key === line.key ? { ...r, description: e.target.value } : r)),
                  )
                }
                className="sm:col-span-2"
              />
              <TextField
                label={idx === 0 ? 'Qty' : undefined}
                type="number"
                min={0}
                step="0.01"
                value={String(line.quantity)}
                onChange={(e) =>
                  setLines((rows) =>
                    rows.map((r) =>
                      r.key === line.key ? { ...r, quantity: Number(e.target.value) || 0 } : r,
                    ),
                  )
                }
              />
              <TextField
                label={idx === 0 ? 'Unit price' : undefined}
                type="number"
                min={0}
                step="0.01"
                value={String(line.unitPrice)}
                onChange={(e) =>
                  setLines((rows) =>
                    rows.map((r) =>
                      r.key === line.key ? { ...r, unitPrice: Number(e.target.value) || 0 } : r,
                    ),
                  )
                }
              />
              {lines.length > 1 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  className="sm:col-span-4"
                  onClick={() => setLines((rows) => rows.filter((r) => r.key !== line.key))}
                >
                  Remove line
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </form>
    </Modal>
  );
}
