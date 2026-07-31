import type { AuditLogDetail } from '../../api/audit-logs';
import {
  formatAuditActionLabel,
  formatAuditJson,
  formatAuditRole,
  formatAuditTimestamp,
  truncateMiddle,
} from '../../lib/audit-log-display';
import { Button } from '../Button';
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
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2 border-b border-border-subtle py-2 text-sm last:border-0">
      <dt className="font-medium text-text-muted">{label}</dt>
      <dd className="min-w-0 break-words font-mono text-xs text-text-body sm:text-sm">{value}</dd>
    </div>
  );
}

const SECTION_TITLE_CLASS = 'mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted';
const META_PANEL_CLASS = 'rounded-lg border border-border-subtle bg-surface-card-muted/50 px-3';
const JSON_PRE_CLASS =
  'max-h-56 overflow-auto rounded-lg border border-border bg-surface-sunken p-3 font-mono text-[11px] leading-relaxed text-brand-700 dark:text-brand-300';

export function AuditLogDetailModal({ open, onClose, row, loading, companyName, labels }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={labels.title}
      widthClass="max-w-3xl"
      footer={
        <Button type="button" variant="secondary" onClick={onClose}>
          {labels.close}
        </Button>
      }
    >
      {loading ? (
        <p className="text-sm text-text-muted">{labels.loading}</p>
      ) : !row ? (
        <p className="text-sm text-text-muted">—</p>
      ) : (
        <div className="space-y-5">
          <section>
            <h3 className={SECTION_TITLE_CLASS}>
              {labels.actor}
            </h3>
            <dl className={META_PANEL_CLASS}>
              <MetaRow label="Email" value={row.actorEmail} />
              <MetaRow label="Name" value={row.actorName} />
              <MetaRow label="Role" value={formatAuditRole(row.actorRole)} />
              <MetaRow label="Actor ID" value={row.actorId ?? '—'} />
            </dl>
          </section>

          <section>
            <h3 className={SECTION_TITLE_CLASS}>
              {labels.action}
            </h3>
            <dl className={META_PANEL_CLASS}>
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
            <h3 className={SECTION_TITLE_CLASS}>
              {labels.metadata}
            </h3>
            <dl className={META_PANEL_CLASS}>
              <MetaRow label={labels.ip} value={row.ipAddress ?? '—'} />
              <MetaRow label={labels.userAgent} value={row.userAgent ?? '—'} />
              <MetaRow label="Event ID" value={truncateMiddle(row.id, 12, 8)} />
            </dl>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className={SECTION_TITLE_CLASS}>
                {labels.before}
              </h3>
              <pre className={JSON_PRE_CLASS}>
                {formatAuditJson(row.previousState)}
              </pre>
            </div>
            <div>
              <h3 className={SECTION_TITLE_CLASS}>
                {labels.after}
              </h3>
              <pre className={JSON_PRE_CLASS}>
                {formatAuditJson(row.newState)}
              </pre>
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
}
