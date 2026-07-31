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

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: Toast['kind'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const value: ToastContextValue = {
    push,
    success: (m) => push('success', m),
    error: (m) => push('error', m),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-md border px-3 py-2 shadow-md text-sm ${
              t.kind === 'error'
                ? 'border-status-danger-border bg-status-danger-bg text-status-danger-fg'
                : t.kind === 'success'
                  ? 'border-status-success-border bg-status-success-bg text-status-success-fg'
                  : 'border-border bg-surface-panel text-text-body'
            }`}
          >
            {t.message}
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
