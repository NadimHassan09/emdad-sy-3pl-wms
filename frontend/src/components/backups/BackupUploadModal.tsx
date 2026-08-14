import { BackupUploadDropzone } from './BackupUploadDropzone';
import { useWmsTranslation } from '../../lib/ui-i18n';
import { Button } from '../Button';
import { Modal } from '../Modal';

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export function BackupUploadModal({ open, onClose, onSuccess }: Props) {
  const { t } = useWmsTranslation();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t(['Upload Backup', 'رفع نسخة احتياطية'])}
      widthClass="max-w-xl"
      footer={
        <Button type="button" variant="secondary" onClick={onClose}>
          {t(['Close', 'إغلاق'])}
        </Button>
      }
    >
      <p className="mb-4 text-sm text-text-muted">
        {t([
          'Upload a PostgreSQL custom-format dump. The server validates the file and stores a checksum.',
          'ارفع ملف dump بصيغة PostgreSQL المخصصة. يتحقق الخادم من الملف ويخزن المجموع الاختباري.',
        ])}
      </p>
      <BackupUploadDropzone
        onSuccess={() => {
          onSuccess?.();
        }}
      />
    </Modal>
  );
}
