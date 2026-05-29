import type { AuditLogDetail } from '../../api/audit-logs';
import {
  formatAuditActionLabel,
  formatAuditJson,
  formatAuditRole,
  formatAuditTimestamp,
  truncateMiddle,
} from '../../lib/audit-log-display';
import { Modal } from '../Modal';

type Props = {
  open: boolean;
  onClose: () => void;
  row: AuditLogDetail | null;
  loading?: boolean;
  companyName?: string | null;
  labels: {
    title: string;
    close: string;
    loading: string;
    actor: string;
    action: string;
    resource: string;
    company: string;
    timestamp: string;
    metadata: string;
    before: string;
    after: string;
    ip: string;
    userAgent: string;
    system: string;
  };
};

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2 border-b border-slate-100 py-2 text-sm last:border-0">
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words font-mono text-xs text-slate-800 sm:text-sm">{value}</dd>
    </div>
  );
}

export function AuditLogDetailModal({ open, onClose, row, loading, companyName, labels }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={labels.title}
      widthClass="max-w-3xl"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {labels.close}
        </button>
      }
    >
      {loading ? (
        <p className="text-sm text-slate-500">{labels.loading}</p>
      ) : !row ? (
        <p className="text-sm text-slate-500">—</p>
      ) : (
        <div className="space-y-5">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {labels.actor}
            </h3>
            <dl className="rounded-lg border border-slate-100 bg-slate-50/50 px-3">
              <MetaRow label="Email" value={row.actorEmail} />
              <MetaRow label="Name" value={row.actorName} />
              <MetaRow label="Role" value={formatAuditRole(row.actorRole)} />
              <MetaRow label="Actor ID" value={row.actorId ?? '—'} />
            </dl>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {labels.action}
            </h3>
            <dl className="rounded-lg border border-slate-100 bg-slate-50/50 px-3">
              <MetaRow label="Action" value={formatAuditActionLabel(row.action)} />
              <MetaRow label={labels.resource} value={`${row.resourceType} · ${row.resourceId}`} />
              <MetaRow
                label={labels.company}
                value={companyName ?? row.companyId ?? labels.system}
              />
              <MetaRow label={labels.timestamp} value={formatAuditTimestamp(row.createdAt)} />
            </dl>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {labels.metadata}
            </h3>
            <dl className="rounded-lg border border-slate-100 bg-slate-50/50 px-3">
              <MetaRow label={labels.ip} value={row.ipAddress ?? '—'} />
              <MetaRow label={labels.userAgent} value={row.userAgent ?? '—'} />
              <MetaRow label="Event ID" value={truncateMiddle(row.id, 12, 8)} />
            </dl>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {labels.before}
              </h3>
              <pre className="max-h-56 overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-3 text-[11px] leading-relaxed text-emerald-100">
                {formatAuditJson(row.previousState)}
              </pre>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {labels.after}
              </h3>
              <pre className="max-h-56 overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-3 text-[11px] leading-relaxed text-emerald-100">
                {formatAuditJson(row.newState)}
              </pre>
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
}
