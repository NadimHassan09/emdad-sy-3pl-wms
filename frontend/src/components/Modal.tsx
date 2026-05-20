import { Portal } from '@ds';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  widthClass?: string;
}

export function Modal({ open, onClose, title, children, footer, widthClass = 'max-w-lg' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[var(--z-modal)] flex items-stretch justify-center overflow-y-auto bg-slate-900/50 sm:items-start sm:px-4 sm:py-12"
        onClick={onClose}
      >
        <div
          className={`relative flex w-full flex-col bg-white shadow-xl sm:my-0 sm:max-h-[calc(100vh-6rem)] sm:rounded-lg ${widthClass}`}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="wms-modal-title"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-white px-4 py-3 sm:rounded-t-lg sm:px-5">
            <h2 id="wms-modal-title" className="min-w-0 truncate text-base font-semibold text-slate-900">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-100"
              aria-label="Close"
            >
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
          {footer && (
            <div className="sticky bottom-0 z-10 flex flex-col-reverse gap-2 border-t bg-white px-4 py-3 sm:flex-row sm:flex-wrap sm:justify-end sm:px-5">
              {footer}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}
