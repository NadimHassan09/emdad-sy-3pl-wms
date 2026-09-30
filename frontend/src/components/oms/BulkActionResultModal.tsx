import type {
  OmsBulkApproveResponse,
  OmsBulkCancelResponse,
  OmsBulkConfirmResponse,
  OmsBulkStatusTransitionResponse,
} from '../../api/oms';
import type { BulkIdsResponse } from '../../api/outbound';
import { Modal } from '../Modal';

type ActionResult =
  | OmsBulkApproveResponse
  | OmsBulkConfirmResponse
  | OmsBulkCancelResponse
  | OmsBulkStatusTransitionResponse
  | BulkIdsResponse;

type ResultItem = {
  orderNumber: string | null;
  status?: string;
  note?: string;
};

type FailureItem = {
  orderNumber: string | null;
  error: string;
};

function isApproveResponse(r: ActionResult): r is OmsBulkApproveResponse {
  return 'approved' in r;
}

function isConfirmResponse(r: ActionResult): r is OmsBulkConfirmResponse {
  return 'confirmed' in r;
}

function isCancelResponse(r: ActionResult): r is OmsBulkCancelResponse {
  return 'cancelled' in r;
}

function normalizeResult(result: ActionResult): {
  succeeded: ResultItem[];
  failures: FailureItem[];
  total: number;
  successCount: number;
  failCount: number;
} {
  if (isApproveResponse(result)) {
    return {
      succeeded: result.approvedOrders.map((o) => ({
        orderNumber: o.orderNumber,
        status: o.status,
      })),
      failures: result.failures.map((f) => ({
        orderNumber: f.orderNumber,
        error: f.error,
      })),
      total: result.requested,
      successCount: result.approved,
      failCount: result.failed,
    };
  }
  if (isConfirmResponse(result)) {
    return {
      succeeded: result.confirmedOrders.map((o) => ({
        orderNumber: o.orderNumber,
        status: o.status,
      })),
      failures: result.failures.map((f) => ({
        orderNumber: f.orderNumber,
        error: f.error,
      })),
      total: result.requested,
      successCount: result.confirmed,
      failCount: result.failed,
    };
  }
  if (isCancelResponse(result)) {
    return {
      succeeded: result.cancelledOrders.map((o) => ({
        orderNumber: o.orderNumber,
        status: o.status,
      })),
      failures: result.failures.map((f) => ({
        orderNumber: f.orderNumber,
        error: f.error,
      })),
      total: result.requested,
      successCount: result.cancelled,
      failCount: result.failed,
    };
  }
  return {
    succeeded: result.completedOrders.map((o) => ({
      orderNumber: o.orderNumber,
      status: o.status,
      note: 'note' in o ? (o as { note?: string }).note : undefined,
    })),
    failures: result.failures.map((f) => ({
      orderNumber: f.orderNumber,
      error: f.error,
    })),
    total: result.requested,
    successCount: result.completed,
    failCount: result.failed,
  };
}

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  result: ActionResult;
};

export function BulkActionResultModal({ open, onClose, title, result }: Props) {
  const { succeeded, failures, total, successCount, failCount } = normalizeResult(result);
  const skipped = total - successCount - failCount;

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-4 p-6 max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-strong">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close result modal"
            className="rounded p-1 hover:bg-surface-hover text-text-faint"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        {/* Summary chips */}
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-status-success-bg px-3 py-1 text-xs font-medium text-status-success-fg">
            <i className="fa-solid fa-check" />
            {successCount} Succeeded
          </span>
          {failCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-status-error-bg px-3 py-1 text-xs font-medium text-status-error-fg">
              <i className="fa-solid fa-xmark" />
              {failCount} Failed
            </span>
          )}
          {skipped > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-text-muted">
              <i className="fa-solid fa-minus" />
              {skipped} Skipped
            </span>
          )}
        </div>

        {/* Successes (collapsed if many) */}
        {succeeded.length > 0 && (
          <div className="rounded-lg border border-border-base overflow-hidden">
            <div className="bg-surface-muted px-4 py-2 text-xs font-semibold text-text-muted uppercase tracking-wide">
              Succeeded ({succeeded.length})
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-border-base">
              {succeeded.map((item, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="font-medium text-text-strong">{item.orderNumber ?? '—'}</span>
                  <div className="flex items-center gap-2">
                    {item.note && (
                      <span className="text-xs text-text-faint italic">{item.note}</span>
                    )}
                    {item.status && (
                      <span className="text-xs text-text-muted">{item.status}</span>
                    )}
                    <i className="fa-solid fa-check text-status-success-fg text-xs" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Failures */}
        {failures.length > 0 && (
          <div className="rounded-lg border border-status-error-border overflow-hidden">
            <div className="bg-status-error-bg px-4 py-2 text-xs font-semibold text-status-error-fg uppercase tracking-wide">
              Failed ({failures.length})
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-border-base">
              {failures.map((f, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-2 text-sm">
                  <i className="fa-solid fa-xmark text-status-error-fg mt-0.5 text-xs shrink-0" />
                  <div className="min-w-0">
                    <span className="font-medium text-text-strong">
                      {f.orderNumber ?? 'Unknown order'}
                    </span>
                    <p className="text-xs text-status-error-fg break-words mt-0.5">{f.error}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          id="bulk-result-close-btn"
          onClick={onClose}
          className="mt-2 w-full rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover transition-colors"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
