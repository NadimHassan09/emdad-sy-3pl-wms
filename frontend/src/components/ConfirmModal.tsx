import { ReactNode } from 'react';

import { Button } from './Button';
import { Modal } from './Modal';

export type CancelButtonVariant = 'secondary' | 'danger' | 'success';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  cancelVariant?: CancelButtonVariant;
  cancelClassName?: string;
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
  cancelVariant,
  cancelClassName,
  loading,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const isKeep =
    cancelVariant === 'success' ||
    (!cancelVariant &&
      (cancelLabel.toLowerCase().includes('keep') ||
        cancelLabel.includes('تراجع') ||
        cancelLabel.includes('إبقاء')));

  const resolvedCancelVariant = cancelVariant ?? (isKeep ? 'success' : 'secondary');

  return (
    <Modal
      open={open}
      onClose={() => !loading && onClose()}
      title={title}
      footer={
        <>
          <Button
            type="button"
            variant={danger ? 'danger' : 'primary'}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
          <Button
            type="button"
            variant={resolvedCancelVariant === 'success' ? 'primary' : resolvedCancelVariant}
            className={
              resolvedCancelVariant === 'success'
                ? '!bg-emerald-600 hover:!bg-emerald-700 !text-white !border-emerald-600 shadow-xs'
                : cancelClassName
            }
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-text-body">{children}</div>
    </Modal>
  );
}
