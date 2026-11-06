import { ReactNode, createContext, useCallback, useContext, useState } from 'react';

interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  message: string;
}

interface ToastContextValue {
  push: (kind: Toast['kind'], message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DURATION: Record<Toast['kind'], number> = {
  success: 4500,
  error: 9000,
  info: 5000,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((kind: Toast['kind'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => dismiss(id), DURATION[kind]);
  }, [dismiss]);

  const value: ToastContextValue = {
    push,
    success: (m) => push('success', m),
    error: (m) => push('error', m),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-96 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2 rounded-md border px-3 py-2.5 shadow-md ${
              t.kind === 'error'
                ? 'border-status-danger-border bg-status-danger-bg text-status-danger-fg'
                : t.kind === 'success'
                  ? 'border-status-success-border bg-status-success-bg text-status-success-fg'
                  : 'border-border bg-surface-panel text-text-body'
            }`}
          >
            <span className="flex-1 text-sm leading-snug">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 opacity-50 hover:opacity-100 text-xs leading-none mt-0.5"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
