import { useMemo } from 'react';

import type { BackupDetail } from '../../api/backups';
import {
  backupCreatedByLabel,
  formatBackupBytes,
  formatBackupStorage,
  formatBackupStoragePolicy,
  formatBackupTimestamp,
  formatBackupType,
  formatGdriveSyncStatus,
  truncateBackupId,
} from '../../lib/backup-display';
import { isBackupGdriveUiEnabled } from '../../lib/backup-gdrive-ui';
import { localizedBackupDetailFieldLabels, localizedBackupStoragePolicyLabel } from '../../lib/ui-labels/settings-backup';
import { useWmsTranslation } from '../../lib/ui-i18n';
import { Button } from '../Button';
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
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2 border-b border-border-subtle py-2 text-sm last:border-0">
      <dt className="font-medium text-text-muted">{label}</dt>
      <dd className="min-w-0 break-words font-mono text-xs text-text-strong sm:text-sm">{value}</dd>
    </div>
  );
}

export function BackupDetailModal({ open, onClose, row, loading, labels }: Props) {
  const { t } = useWmsTranslation();
  const gdriveUiEnabled = isBackupGdriveUiEnabled();
  const fields = useMemo(() => localizedBackupDetailFieldLabels(t), [t]);

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
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              {labels.overview}
            </h3>
            <dl className="rounded-lg border border-border-subtle bg-surface-card-muted px-3">
              <MetaRow label={fields.id} value={row.id} />
              <MetaRow label={fields.shortId} value={truncateBackupId(row.id)} />
              <MetaRow label={fields.type} value={formatBackupType(row.type)} />
              <MetaRow label={fields.status} value={row.status} />
              <MetaRow label={fields.label} value={row.label ?? '—'} />
              <MetaRow label={fields.created} value={formatBackupTimestamp(row.createdAt)} />
              <MetaRow label={fields.completed} value={formatBackupTimestamp(row.completedAt)} />
              <MetaRow label={fields.createdBy} value={backupCreatedByLabel(row)} />
              <MetaRow
                label={fields.storagePolicy}
                value={
                  row.storagePolicy
                    ? localizedBackupStoragePolicyLabel(row.storagePolicy, t)
                    : formatBackupStoragePolicy(row.storagePolicy)
                }
              />
              <MetaRow label={fields.storage} value={formatBackupStorage(row.manifest)} />
              {gdriveUiEnabled ? (
                <>
                  <MetaRow
                    label={fields.driveSync}
                    value={formatGdriveSyncStatus(row.gdriveSyncStatus, row.storagePolicy)}
                  />
                  <MetaRow
                    label={fields.driveSyncedAt}
                    value={formatBackupTimestamp(row.gdriveSyncedAt)}
                  />
                </>
              ) : null}
              <MetaRow label={fields.size} value={formatBackupBytes(row.bytesWritten)} />
              <MetaRow label={fields.progress} value={`${row.progressPercent}%`} />
            </dl>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              {labels.technical}
            </h3>
            <dl className="rounded-lg border border-border-subtle bg-surface-card-muted px-3">
              <MetaRow label={fields.dumpFile} value={row.dumpFilename ?? '—'} />
              <MetaRow label={fields.started} value={formatBackupTimestamp(row.startedAt)} />
              <MetaRow
                label={fields.checksum}
                value={row.manifest?.checksumSha256 ?? '—'}
              />
              <MetaRow label={fields.db} value={row.manifest?.dbName ?? '—'} />
              <MetaRow label={fields.pgVersion} value={row.manifest?.pgVersion ?? '—'} />
              {gdriveUiEnabled && row.gdriveFileId ? (
                <MetaRow label={fields.driveFileId} value={row.gdriveFileId} />
              ) : null}
              {gdriveUiEnabled && row.gdriveSyncAttempts > 0 ? (
                <MetaRow label={fields.driveSyncAttempts} value={String(row.gdriveSyncAttempts)} />
              ) : null}
              {gdriveUiEnabled && row.gdriveNextRetryAt ? (
                <MetaRow
                  label={fields.driveNextRetry}
                  value={formatBackupTimestamp(row.gdriveNextRetryAt)}
                />
              ) : null}
            </dl>
          </section>

          {gdriveUiEnabled && row.gdriveSyncError ? (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-status-danger-fg">
                {fields.driveSyncError}
              </h3>
              <pre className="max-h-48 overflow-auto rounded-lg border border-status-danger-border bg-status-danger-bg/60 p-3 text-xs text-status-danger-fg">
                {row.gdriveSyncError}
              </pre>
            </section>
          ) : null}

          {row.errorMessage ? (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-status-danger-fg">
                {labels.error}
              </h3>
              <pre className="max-h-48 overflow-auto rounded-lg border border-status-danger-border bg-status-danger-bg/60 p-3 text-xs text-status-danger-fg">
                {row.errorMessage}
              </pre>
            </section>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
