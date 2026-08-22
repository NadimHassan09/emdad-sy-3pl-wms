import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Alert, Card, ListPageHeader, Skeleton } from '@ds';

import type { CodRecordStatus } from '../api/oms';
import { CodApi } from '../api/oms';
import { Column, DataTable } from '../components/DataTable';
import { useToast } from '../components/ToastProvider';

const COD_RECORD_STATUS_OPTIONS: { value: CodRecordStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'available', label: 'Available' },
  { value: 'paid_out', label: 'Paid out' },
  { value: 'returned', label: 'Returned' },
];

const COD_STATUS_SELECT_CLASS: Record<CodRecordStatus, string> = {
  pending:
    'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100',
  available:
    'border-brand-300 bg-brand-50 text-brand-900 dark:border-brand-700/50 dark:bg-brand-950/40 dark:text-brand-100',
  paid_out:
    'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700/60 dark:bg-emerald-950/40 dark:text-emerald-100',
  returned:
    'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-700/60 dark:bg-rose-950/40 dark:text-rose-100',
};

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-text-muted">{label}</div>
      <div className="mt-0.5 text-sm text-text-strong">{value}</div>
    </div>
  );
}

function fmtMoney(value: string | null | undefined, currency?: string | null): string {
  if (!value) return '—';
  return `${value}${currency ? ` ${currency}` : ''}`;
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function statusLabel(status: CodRecordStatus): string {
  return status.replace(/_/g, ' ');
}

export function OmsCodDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const toast = useToast();
  const qc = useQueryClient();

  const detail = useQuery({
    queryKey: ['oms-cod-records', id],
    queryFn: () => CodApi.getRecord(id),
    enabled: !!id,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['oms-cod-records', id] });
    void qc.invalidateQueries({ queryKey: ['oms-cod-records'] });
  };

  const statusMut = useMutation({
    mutationFn: (status: CodRecordStatus) => CodApi.setStatus(id, status),
    onSuccess: () => {
      toast.success('COD status updated.');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!id) return null;

  if (detail.isLoading) {
    return (
      <div className="space-y-5 animate-enter">
        <Skeleton height={24} width="30%" />
        <Card>
          <div className="space-y-4" aria-busy="true">
            <Skeleton height={28} width="40%" />
            <Skeleton height={140} />
          </div>
        </Card>
      </div>
    );
  }

  if (detail.isError || !detail.data) {
    return (
      <div className="space-y-5 animate-enter">
        <Link
          to="/oms/cod"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-text-strong"
        >
          <i className="fa-solid fa-arrow-left rtl:rotate-180 text-xs" aria-hidden="true" />
          Back to COD
        </Link>
        <Alert variant="error" title="Could not load COD record." />
      </div>
    );
  }

  const record = detail.data;
  const orderLabel = record.omsOrder?.orderNumber ?? record.omsOrderId.slice(0, 8);

  const adjustmentCols: Column<(typeof record.adjustments)[number]>[] = [
    {
      header: 'Amount',
      accessor: (row) => fmtMoney(row.amount, record.currency),
    },
    {
      header: 'Reason',
      accessor: (row) => row.reason?.trim() || '—',
    },
    {
      header: 'Return',
      accessor: (row) =>
        row.omsReturnId ? (
          <span className="font-mono text-xs">{row.omsReturnId.slice(0, 8)}…</span>
        ) : (
          '—'
        ),
    },
    {
      header: 'Created',
      accessor: (row) => fmtDate(row.createdAt),
    },
  ];

  return (
    <div className="space-y-5 animate-enter">
      <Link
        to="/oms/cod"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-text-strong"
      >
        <i className="fa-solid fa-arrow-left rtl:rotate-180 text-xs" aria-hidden="true" />
        Back to COD
      </Link>

      <ListPageHeader
        icon="fa-money-bill"
        title={`COD · ${orderLabel}`}
        subtitle={record.company?.name ?? undefined}
        actions={
          <div className="min-w-[180px]" onClick={(e) => e.stopPropagation()}>
            <label className="block min-w-0">
              <span className="mb-1 block text-xs font-medium text-text-muted">Status</span>
              <select
                aria-label="COD status"
                name="cod-detail-status"
                value={record.status}
                disabled={statusMut.isPending}
                className={`input-premium w-full rounded-lg border px-3 py-2 text-sm font-semibold ${COD_STATUS_SELECT_CLASS[record.status]}`}
                onChange={(e) => {
                  const next = e.target.value as CodRecordStatus;
                  if (next === record.status) return;
                  statusMut.mutate(next);
                }}
              >
                {COD_RECORD_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card padding="none">
          <Card.Header>
            <Card.Title>Record</Card.Title>
          </Card.Header>
          <Card.Body className="px-4 py-4 sm:px-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Status" value={statusLabel(record.status)} />
              <Field label="Currency" value={record.currency || '—'} />
              <Field
                label="Original amount"
                value={fmtMoney(record.originalAmount, record.currency)}
              />
              <Field
                label="Current amount"
                value={
                  <span className="font-semibold">
                    {fmtMoney(record.currentAmount, record.currency)}
                  </span>
                }
              />
              <Field label="Available at" value={fmtDate(record.availableAt)} />
              <Field label="Paid out at" value={fmtDate(record.paidOutAt)} />
              <Field label="Created" value={fmtDate(record.createdAt)} />
              <Field label="Updated" value={fmtDate(record.updatedAt)} />
            </div>
            {record.notes?.trim() ? (
              <div className="mt-4">
                <Field label="Notes" value={record.notes} />
              </div>
            ) : null}
          </Card.Body>
        </Card>

        <Card padding="none">
          <Card.Header>
            <Card.Title>Order & client</Card.Title>
          </Card.Header>
          <Card.Body className="px-4 py-4 sm:px-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Order"
                value={
                  <Link
                    to={`/orders/oms/${record.omsOrderId}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {orderLabel}
                  </Link>
                }
              />
              <Field
                label="Order status"
                value={record.omsOrder?.status?.replace(/_/g, ' ') ?? '—'}
              />
              <Field label="Client" value={record.company?.name ?? '—'} />
              <Field
                label="Recipient"
                value={record.omsOrder?.recipientName?.trim() || '—'}
              />
              <Field
                label="Payment method"
                value={record.omsOrder?.paymentMethod ?? '—'}
              />
            </div>
          </Card.Body>
        </Card>
      </div>

      <Card padding="none">
        <Card.Header>
          <Card.Title>Adjustments</Card.Title>
        </Card.Header>
        <Card.Body className="px-0 py-0 sm:px-0">
          <DataTable
            columns={adjustmentCols}
            rows={record.adjustments}
            rowKey={(row) => row.id}
            empty="No adjustments on this COD record."
          />
        </Card.Body>
      </Card>
    </div>
  );
}
