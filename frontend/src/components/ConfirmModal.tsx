import { ReactNode } from 'react';

import { Button } from './Button';
import { Modal } from './Modal';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmModal({
  open,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger,
  loading,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={() => !loading && onClose()}
      title={title}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={danger ? 'danger' : 'primary'}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-slate-600">{children}</div>
    </Modal>
  );
}
