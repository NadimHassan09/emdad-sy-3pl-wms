import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

/** Blocks in-app SPA navigations via React Router while `shouldBlock` (e.g. unsynced execution notes). */
export function useExecutionExitBlocker(shouldBlock: boolean, message?: string): void {
  const blocker = useBlocker(shouldBlock);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    const ok = window.confirm(message ?? 'Leave this task? Unsaved progress may still be syncing.');
    if (ok) blocker.proceed();
    else blocker.reset();
  }, [blocker, blocker.state, message]);
}
