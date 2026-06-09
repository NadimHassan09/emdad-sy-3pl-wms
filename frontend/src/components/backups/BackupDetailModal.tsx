import { useMemo } from 'react';

import type { BackupDetail } from '../../api/backups';
import {
  backupCreatedByLabel,
  formatBackupBytes,
  formatBackupStorage,
  formatBackupTimestamp,
  formatBackupType,
  truncateBackupId,
} from '../../lib/backup-display';
import { localizedBackupDetailFieldLabels } from '../../lib/ui-labels/settings-backup';
import { useWmsTranslation } from '../../lib/ui-i18n';
import { Modal } from '../Modal';

type Props = {
  open: boolean;
  onClose: () => void;
  row: BackupDetail | null;
  loading?: boolean;
  labels: {
    title: string;
    close: string;
    loading: string;
    overview: string;
    technical: string;
    error: string;
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

export function BackupDetailModal({ open, onClose, row, loading, labels }: Props) {
  const { t } = useWmsTranslation();
  const fields = useMemo(() => localizedBackupDetailFieldLabels(t), [t]);

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
              {labels.overview}
            </h3>
            <dl className="rounded-lg border border-slate-100 bg-slate-50/50 px-3">
              <MetaRow label={fields.id} value={row.id} />
              <MetaRow label={fields.shortId} value={truncateBackupId(row.id)} />
              <MetaRow label={fields.type} value={formatBackupType(row.type)} />
              <MetaRow label={fields.status} value={row.status} />
              <MetaRow label={fields.label} value={row.label ?? '—'} />
              <MetaRow label={fields.created} value={formatBackupTimestamp(row.createdAt)} />
              <MetaRow label={fields.completed} value={formatBackupTimestamp(row.completedAt)} />
              <MetaRow label={fields.createdBy} value={backupCreatedByLabel(row)} />
              <MetaRow label={fields.storage} value={formatBackupStorage(row.manifest)} />
              <MetaRow label={fields.size} value={formatBackupBytes(row.bytesWritten)} />
              <MetaRow label={fields.progress} value={`${row.progressPercent}%`} />
            </dl>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {labels.technical}
            </h3>
            <dl className="rounded-lg border border-slate-100 bg-slate-50/50 px-3">
              <MetaRow label={fields.dumpFile} value={row.dumpFilename ?? '—'} />
              <MetaRow label={fields.started} value={formatBackupTimestamp(row.startedAt)} />
              <MetaRow
                label={fields.checksum}
                value={row.manifest?.checksumSha256 ?? '—'}
              />
              <MetaRow label={fields.db} value={row.manifest?.dbName ?? '—'} />
              <MetaRow label={fields.pgVersion} value={row.manifest?.pgVersion ?? '—'} />
            </dl>
          </section>

          {row.errorMessage ? (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-600">
                {labels.error}
              </h3>
              <pre className="max-h-48 overflow-auto rounded-lg border border-rose-100 bg-rose-50/60 p-3 text-xs text-rose-900">
                {row.errorMessage}
              </pre>
            </section>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
