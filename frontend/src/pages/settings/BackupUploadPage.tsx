import { useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';

import { useAuth } from '../../auth/AuthContext';
import { BackupAuditPanel } from '../../components/backups/BackupAuditPanel';
import { BackupUploadDropzone } from '../../components/backups/BackupUploadDropzone';
import { PANEL_CARD_CLASS, PANEL_TITLE_CLASS } from '../../components/FilterPanel';
import { QK } from '../../constants/query-keys';
import { defaultHomePath } from '../../lib/rbac';
import { useWmsTranslation } from '../../lib/ui-i18n';

export function BackupUploadPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useWmsTranslation();

  if (user?.role !== 'super_admin') {
    return <Navigate to={defaultHomePath(user?.role)} replace />;
  }

  return (
    <div className="space-y-4">
      <section className={PANEL_CARD_CLASS}>
        <h2 className={PANEL_TITLE_CLASS}>{t(['Upload Backup', 'رفع نسخة احتياطية'])}</h2>
        <p className="text-sm text-slate-600">
          {t([
            'Upload a PostgreSQL custom-format dump. The server validates the file and stores a checksum.',
            'ارفع ملف dump بصيغة PostgreSQL المخصصة. يتحقق الخادم من الملف ويخزن المجموع الاختباري.',
          ])}
        </p>
        <div className="mt-4">
          <BackupUploadDropzone
            onSuccess={() => {
              void queryClient.invalidateQueries({ queryKey: QK.backups.all });
            }}
          />
        </div>
      </section>
      <BackupAuditPanel />
    </div>
  );
}
