import { Modal as DsModal } from '@ds';
import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  widthClass?: string;
}

/**
 * Admin / client-portal modal — delegates to the design-system Modal so
 * centering, backdrop, and z-index stay consistent across apps.
 */
export function Modal({ open, onClose, title, children, footer, widthClass = 'max-w-lg' }: ModalProps) {
  return (
    <DsModal open={open} onClose={onClose} title={title} footer={footer} widthClass={widthClass}>
      {children}
    </DsModal>
  );
}
