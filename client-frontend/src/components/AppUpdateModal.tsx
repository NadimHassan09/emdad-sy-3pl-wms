import { useState } from 'react';
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
      aria-labelledby="client-update-modal-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 text-center">
        {/* Ambient background glow */}
        <div className="pointer-events-none absolute -top-16 -left-16 h-36 w-36 rounded-full bg-emerald-500/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 -right-16 h-36 w-36 rounded-full bg-teal-500/15 blur-2xl" />

        {/* Header Icon */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-400 shadow-sm">
          <svg
            className="h-7 w-7 animate-pulse"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
            />
          </svg>
        </div>

        {/* Title */}
        <h3
          id="client-update-modal-title"
          className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight"
        >
          New Version Available
        </h3>

        {/* Body Message */}
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          There&apos;s a new version available. The system needs to refresh to apply the latest update.
        </p>

        {latestVersion && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800/80 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            <span>Version</span>
            <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
              v{latestVersion}
            </span>
          </div>
        )}

        {/* Action Button */}
        <div className="mt-6">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-75 cursor-pointer"
          >
            <svg
              className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
