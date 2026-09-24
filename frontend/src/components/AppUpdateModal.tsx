import { useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { useUpdateDetector } from '../hooks/useUpdateDetector';

export function AppUpdateModal() {
  const { hasUpdate, latestVersion, refreshApp } = useUpdateDetector();
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!hasUpdate) {
    return null;
  }

  const handleRefresh = () => {
    setIsRefreshing(true);
    refreshApp();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-modal-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 text-center">
        {/* Decorative ambient background glow */}
        <div className="pointer-events-none absolute -top-16 -left-16 h-36 w-36 rounded-full bg-primary-500/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 -right-16 h-36 w-36 rounded-full bg-blue-500/15 blur-2xl" />

        {/* Header Icon */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 dark:bg-primary-950/50 border border-primary-100 dark:border-primary-800/60 text-primary-600 dark:text-primary-400 shadow-sm">
          <Sparkles className="h-7 w-7 animate-pulse" />
        </div>

        {/* Title */}
        <h3
          id="update-modal-title"
          className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight"
        >
          New Version Available
        </h3>

        {/* Body Message requested by user */}
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          There&apos;s a new version available. The system needs to refresh to apply the latest update.
        </p>

        {latestVersion && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800/80 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            <span>Version</span>
            <span className="font-mono font-semibold text-primary-600 dark:text-primary-400">
              v{latestVersion}
            </span>
          </div>
        )}

        {/* Refresh Action Button */}
        <div className="mt-6">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-700 active:bg-primary-800 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-600/25 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-75 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
