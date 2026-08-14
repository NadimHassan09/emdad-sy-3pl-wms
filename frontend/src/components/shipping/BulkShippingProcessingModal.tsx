import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import {
  BulkShippingJobView,
  BulkShippingPreviewLine,
  BulkShippingPreviewResult,
  ShippingApi,
} from '../../api/shipping';
import { Alert, Button as DsButton } from '@ds';
import { ConfirmModal } from '../ConfirmModal';
import { Modal } from '../Modal';
import { useToast } from '../ToastProvider';
import { QK } from '../../constants/query-keys';

type Step = 'review' | 'confirm' | 'progress' | 'results';

type Props = {
  open: boolean;
  outboundOrderIds: string[];
  onClose: () => void;
};

function fmtMoney(amount: number | string | null | undefined, currency: string | null | undefined) {
  if (amount == null || amount === '') return '—';
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency ?? ''}`.trim();
}

export function BulkShippingProcessingModal({ open, outboundOrderIds, onClose }: Props) {
  const toast = useToast();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>('review');
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [jobId, setJobId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resultFilter, setResultFilter] = useState<'all' | 'succeeded' | 'failed'>('all');

  useEffect(() => {
    if (!open) {
      setStep('review');
      setSelections({});
      setJobId(null);
      setConfirmOpen(false);
      setResultFilter('all');
    }
  }, [open]);

  const previewQuery = useQuery({
    queryKey: ['shipping-bulk-preview', outboundOrderIds],
    queryFn: () => ShippingApi.bulkPreview(outboundOrderIds),
    enabled: open && outboundOrderIds.length > 0 && step === 'review',
    staleTime: 30_000,
  });

  useEffect(() => {
    const lines = previewQuery.data?.lines;
    if (!lines?.length) return;
    setSelections((prev) => {
      const next = { ...prev };
      for (const line of lines) {
        if (!next[line.outboundOrderId]) {
          next[line.outboundOrderId] = line.selectedProviderCode;
        }
      }
      return next;
    });
  }, [previewQuery.data]);

  const jobQuery = useQuery({
    queryKey: ['shipping-bulk-job', jobId],
    queryFn: () => ShippingApi.bulkGetJob(jobId!),
    enabled: !!jobId && (step === 'progress' || step === 'results'),
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (!status) return 1500;
      if (status === 'processing' || status === 'pending') return 1200;
      return false;
    },
  });

  useEffect(() => {
    const job = jobQuery.data;
    if (!job) return;
    if (
      job.status === 'completed' ||
      job.status === 'completed_with_errors' ||
      job.status === 'failed' ||
      job.status === 'cancelled'
    ) {
      setStep('results');
      qc.invalidateQueries({ queryKey: QK.outboundOrders });
    }
  }, [jobQuery.data, qc]);

  const confirmMut = useMutation({
    mutationFn: (items: Parameters<typeof ShippingApi.bulkConfirm>[0]) =>
      ShippingApi.bulkConfirm(items),
    onSuccess: (job) => {
      setConfirmOpen(false);
      setJobId(job.id);
      setStep('progress');
      toast.success('Bulk shipping started.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const retryMut = useMutation({
    mutationFn: (outboundOrderId: string) =>
      ShippingApi.bulkRetryItem(jobId!, outboundOrderId),
    onSuccess: () => {
      toast.success('Retry started.');
      setStep('progress');
      void jobQuery.refetch();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const labelsMut = useMutation({
    mutationFn: () => ShippingApi.bulkGetLabels(jobId!),
    onSuccess: (data) => {
      let printed = 0;
      for (const label of data.labels) {
        if (label.url) {
          window.open(label.url, '_blank', 'noopener,noreferrer');
          printed += 1;
        } else if (label.pdfBase64) {
          const bin = atob(label.pdfBase64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
          const blob = new Blob([bytes], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank', 'noopener,noreferrer');
          printed += 1;
        }
      }
      if (printed === 0) {
        toast.error('No printable labels returned by the carrier API.');
      } else {
        toast.success(`Opened ${printed} label(s).`);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const preview = previewQuery.data;
  const estimated = useMemo(() => {
    if (!preview) return { total: null as number | null, currency: null as string | null };
    let total = 0;
    let currency: string | null = null;
    let any = false;
    for (const line of preview.lines) {
      const code = selections[line.outboundOrderId] ?? line.selectedProviderCode;
      const quote = line.quotes.find((q) => q.providerCode === code);
      if (quote) {
        total += quote.price;
        currency = quote.currency;
        any = true;
      } else if (code === line.recommendedProviderCode && line.recommendedPrice != null) {
        total += line.recommendedPrice;
        currency = line.recommendedCurrency;
        any = true;
      }
    }
    return { total: any ? total : null, currency };
  }, [preview, selections]);

  const buildConfirmItems = () => {
    if (!preview) return [];
    return preview.lines.map((line) => {
      const code = selections[line.outboundOrderId] ?? line.selectedProviderCode;
      const quote = line.quotes.find((q) => q.providerCode === code);
      return {
        outboundOrderId: line.outboundOrderId,
        providerCode: code,
        quotedPrice: quote?.price ?? (code === line.recommendedProviderCode ? line.recommendedPrice : null),
        quotedCurrency:
          quote?.currency ??
          (code === line.recommendedProviderCode ? line.recommendedCurrency : null),
        recommendedProviderCode: line.recommendedProviderCode,
      };
    });
  };

  const job: BulkShippingJobView | undefined = jobQuery.data;
  const filteredItems = useMemo(() => {
    if (!job) return [];
    if (resultFilter === 'all') return job.items;
    if (resultFilter === 'succeeded') {
      return job.items.filter((i) => i.status === 'succeeded' || i.status === 'skipped');
    }
    return job.items.filter((i) => i.status === 'failed');
  }, [job, resultFilter]);

  const closeAllowed =
    step === 'review' ||
    step === 'results' ||
    (step === 'progress' &&
      job &&
      job.status !== 'processing' &&
      job.status !== 'pending');

  return (
    <>
      <Modal
        open={open}
        onClose={() => closeAllowed && onClose()}
        title="Bulk Shipping Processing"
        widthClass="max-w-5xl"
        footer={
          step === 'review' ? (
            <>
              <DsButton variant="secondary" onClick={onClose} disabled={confirmMut.isPending}>
                Cancel
              </DsButton>
              <DsButton
                variant="primary"
                disabled={!preview?.lines.length || previewQuery.isLoading || confirmMut.isPending}
                onClick={() => setConfirmOpen(true)}
              >
                Confirm Bulk Processing
              </DsButton>
            </>
          ) : step === 'progress' ? (
            <DsButton variant="secondary" onClick={onClose} disabled={!closeAllowed}>
              {closeAllowed ? 'Close' : 'Processing…'}
            </DsButton>
          ) : (
            <>
              <DsButton
                variant="secondary"
                onClick={() => labelsMut.mutate()}
                disabled={!jobId || labelsMut.isPending}
              >
                Print / Download Labels
              </DsButton>
              <DsButton variant="primary" onClick={onClose}>
                Done
              </DsButton>
            </>
          )
        }
      >
        {step === 'review' && (
          <ReviewStep
            loading={previewQuery.isLoading}
            error={previewQuery.error as Error | null}
            preview={preview}
            selections={selections}
            estimated={estimated}
            onChangeProvider={(orderId, code) =>
              setSelections((prev) => ({ ...prev, [orderId]: code }))
            }
            onRetryPreview={() => void previewQuery.refetch()}
          />
        )}

        {step === 'progress' && job && (
          <div className="space-y-4">
            <p className="text-sm text-text-body">Creating shipments…</p>
            <div className="h-3 w-full overflow-hidden rounded-full bg-surface-sunken">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{ width: `${job.progressPercent}%` }}
              />
            </div>
            <p className="text-sm text-text-muted">
              {job.successCount + job.failedCount + job.skippedCount} / {job.totalCount} processed
              · Successful: {job.successCount}
              · Failed: {job.failedCount}
              · Manual/skipped: {job.skippedCount}
            </p>
          </div>
        )}

        {step === 'results' && job && (
          <ResultsStep
            job={job}
            filter={resultFilter}
            items={filteredItems}
            onFilter={setResultFilter}
            onRetry={(id) => retryMut.mutate(id)}
            retrying={retryMut.isPending}
          />
        )}
      </Modal>

      <ConfirmModal
        open={confirmOpen}
        title="Confirm Bulk Shipping"
        confirmLabel="Confirm & Create Shipments"
        cancelLabel="Cancel"
        loading={confirmMut.isPending}
        onClose={() => !confirmMut.isPending && setConfirmOpen(false)}
        onConfirm={() => confirmMut.mutate(buildConfirmItems())}
      >
        <p className="text-sm text-text-body">
          You are about to create shipments for <strong>{outboundOrderIds.length}</strong> order
          {outboundOrderIds.length === 1 ? '' : 's'}.
        </p>
        <p className="mt-2 text-sm text-text-body">
          Estimated total shipping cost:{' '}
          <strong>{fmtMoney(estimated.total, estimated.currency)}</strong>
        </p>
        <p className="mt-2 text-sm text-text-muted">
          The system will send these orders to their selected shipping companies. Orders already
          Waiting for Dispatch stay in that state — Dispatch is separate.
        </p>
      </ConfirmModal>
    </>
  );
}

function ReviewStep(props: {
  loading: boolean;
  error: Error | null;
  preview?: BulkShippingPreviewResult;
  selections: Record<string, string>;
  estimated: { total: number | null; currency: string | null };
  onChangeProvider: (orderId: string, code: string) => void;
  onRetryPreview: () => void;
}) {
  const { loading, error, preview, selections, estimated, onChangeProvider, onRetryPreview } =
    props;

  if (loading) {
    return <p className="text-sm text-text-muted">Fetching quotes (no shipments are created)…</p>;
  }
  if (error) {
    return (
      <Alert variant="error" title="Could not build bulk preview" description={error.message}>
        <Alert.Action onClick={onRetryPreview}>Retry</Alert.Action>
      </Alert>
    );
  }
  if (!preview) return null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-body">
        Selected orders: <strong>{preview.lines.length}</strong>
      </p>
      <Alert
        variant="info"
        title="Quotation only"
        description="Opening this screen and fetching quotes does not create carrier shipments. Confirm Bulk Processing is required to send."
      />

      <div className="max-h-[28rem] overflow-auto rounded-lg border border-border-subtle">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 bg-surface-sunken text-text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Order</th>
              <th className="px-3 py-2 font-medium">Weight</th>
              <th className="px-3 py-2 font-medium">Volume</th>
              <th className="px-3 py-2 font-medium">Carrier</th>
              <th className="px-3 py-2 font-medium">Price</th>
            </tr>
          </thead>
          <tbody>
            {preview.lines.map((line) => (
              <ReviewRow
                key={line.outboundOrderId}
                line={line}
                providers={preview.selectableProviders}
                selected={selections[line.outboundOrderId] ?? line.selectedProviderCode}
                onChange={(code) => onChangeProvider(line.outboundOrderId, code)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-text-body">
        {preview.lines.length} Orders · Estimated Shipping Cost:{' '}
        <strong>{fmtMoney(estimated.total, estimated.currency)}</strong>
      </p>
    </div>
  );
}

function ReviewRow(props: {
  line: BulkShippingPreviewLine;
  providers: BulkShippingPreviewResult['selectableProviders'];
  selected: string;
  onChange: (code: string) => void;
}) {
  const { line, providers, selected, onChange } = props;
  const quote = line.quotes.find((q) => q.providerCode === selected);
  const price =
    quote?.price ??
    (selected === line.recommendedProviderCode ? line.recommendedPrice : null);
  const currency =
    quote?.currency ??
    (selected === line.recommendedProviderCode ? line.recommendedCurrency : null);

  return (
    <tr className="border-t border-border-subtle">
      <td className="px-3 py-2">
        <div className="font-mono text-text-strong">
          {line.omsOrderNumber || line.orderNumber}
        </div>
        <div className="text-xs text-text-faint">{line.companyName}</div>
      </td>
      <td className="px-3 py-2">{line.weightKg != null ? `${line.weightKg} kg` : '—'}</td>
      <td className="px-3 py-2">{line.volumeCbm != null ? `${line.volumeCbm} m³` : '—'}</td>
      <td className="px-3 py-2">
        <select
          className="input-premium w-full min-w-[10rem] rounded-md border border-border-strong bg-surface px-2 py-1 text-sm"
          value={selected}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`Carrier for ${line.orderNumber}`}
        >
          {providers.map((p) => (
            <option key={p.code} value={p.code} disabled={p.code !== 'MANUAL' && !p.connected}>
              {p.name}
              {p.code === line.recommendedProviderCode ? ' (recommended)' : ''}
              {p.code !== 'MANUAL' && !p.connected ? ' — not connected' : ''}
            </option>
          ))}
        </select>
        {line.recommendationNote && !line.recommendedProviderCode ? (
          <div className="mt-1 text-xs text-text-faint">{line.recommendationNote}</div>
        ) : null}
      </td>
      <td className="px-3 py-2 whitespace-nowrap">{fmtMoney(price, currency)}</td>
    </tr>
  );
}

function ResultsStep(props: {
  job: BulkShippingJobView;
  filter: 'all' | 'succeeded' | 'failed';
  items: BulkShippingJobView['items'];
  onFilter: (f: 'all' | 'succeeded' | 'failed') => void;
  onRetry: (outboundOrderId: string) => void;
  retrying: boolean;
}) {
  const { job, filter, items, onFilter, onRetry, retrying } = props;
  return (
    <div className="space-y-4">
      <Alert
        variant={job.failedCount > 0 ? 'warning' : 'success'}
        title="Bulk Processing Complete"
        description={`Successful: ${job.successCount} · Failed: ${job.failedCount} · Manual/skipped: ${job.skippedCount}`}
      />
      <p className="text-xs text-text-muted">
        Job #{job.id.slice(0, 8)} · Status: {job.status.replaceAll('_', ' ')} · Orders remain
        Waiting for Dispatch until you complete Dispatch separately.
      </p>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['all', 'All'],
            ['succeeded', 'View Successful Orders'],
            ['failed', 'View Failed Orders'],
          ] as const
        ).map(([key, label]) => (
          <DsButton
            key={key}
            size="sm"
            variant={filter === key ? 'primary' : 'secondary'}
            onClick={() => onFilter(key)}
          >
            {label}
          </DsButton>
        ))}
      </div>
      <div className="max-h-[22rem] overflow-auto rounded-lg border border-border-subtle">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 bg-surface-sunken text-text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Order</th>
              <th className="px-3 py-2 font-medium">Carrier</th>
              <th className="px-3 py-2 font-medium">AWB</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-border-subtle">
                <td className="px-3 py-2 font-mono">
                  {item.omsOrderNumber || item.orderNumber || item.outboundOrderId.slice(0, 8)}
                </td>
                <td className="px-3 py-2">{item.selectedProviderCode}</td>
                <td className="px-3 py-2 font-mono">{item.externalAwb || '—'}</td>
                <td className="px-3 py-2">
                  <div>{item.status}</div>
                  {item.lastErrorSafe ? (
                    <div className="text-xs text-danger">{item.lastErrorSafe}</div>
                  ) : null}
                  {item.labelCapability === 'api' && item.externalAwb ? (
                    <div className="text-xs text-text-faint">Shipping label: Available to print</div>
                  ) : item.status === 'succeeded' ? (
                    <div className="text-xs text-text-faint">
                      Shipping label: {item.labelCapability === 'carrier_provided' ? 'Provided by carrier' : 'No shipping label available from carrier API'}
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  {item.status === 'failed' ? (
                    <DsButton
                      size="sm"
                      variant="secondary"
                      disabled={retrying}
                      onClick={() => onRetry(item.outboundOrderId)}
                    >
                      Retry
                    </DsButton>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
