import { useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { SectionContainer } from '@ds';

import { useAuth } from '../../auth/AuthContext';
import { BackupAuditPanel } from '../../components/backups/BackupAuditPanel';
import { BackupUploadDropzone } from '../../components/backups/BackupUploadDropzone';
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
      <SectionContainer
        title={t(['Upload Backup', 'رفع نسخة احتياطية'])}
        description={t([
          'Upload a PostgreSQL custom-format dump. The server validates the file and stores a checksum.',
          'ارفع ملف dump بصيغة PostgreSQL المخصصة. يتحقق الخادم من الملف ويخزن المجموع الاختباري.',
        ])}
      >
        <BackupUploadDropzone
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: QK.backups.all });
          }}
        />
      </SectionContainer>
      <BackupAuditPanel />
    </div>
  );
}
