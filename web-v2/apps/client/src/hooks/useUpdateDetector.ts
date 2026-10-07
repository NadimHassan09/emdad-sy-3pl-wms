import { useEffect, useState, useCallback, useRef } from 'react';

const UPDATE_EVENT_NAME = 'wms:app-update-detected';
const CHECK_INTERVAL_MS = 60_000; // 60 seconds

export interface VersionPayload {
  version: string;
  buildId: string;
  buildTime: string;
}

/**
 * Manually signal that an update was detected (e.g. from chunk load error).
 */
export function triggerAppUpdate(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT_NAME));
  }
}

/**
 * Hook to detect new deployments via static /version.json.
 * Polls on startup, on tab visibility change/focus, and every 60s.
 */
export function useUpdateDetector() {
  const [hasUpdate, setHasUpdate] = useState<boolean>(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const checkingRef = useRef<boolean>(false);

  const currentBuildId = typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : '';

  const checkForUpdate = useCallback(async (): Promise<boolean> => {
    if (!currentBuildId || checkingRef.current) return false;
    checkingRef.current = true;
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      if (!res.ok) return false;

      const data = (await res.json()) as VersionPayload;
      if (data && typeof data.buildId === 'string' && data.buildId !== currentBuildId) {
        setHasUpdate(true);
        if (data.version) {
          setLatestVersion(data.version);
        }
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      checkingRef.current = false;
    }
  }, [currentBuildId]);

  useEffect(() => {
    void checkForUpdate();

    const onManualUpdate = () => {
      setHasUpdate(true);
    };
    window.addEventListener(UPDATE_EVENT_NAME, onManualUpdate);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkForUpdate();
      }
    };
    const onFocus = () => {
      void checkForUpdate();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);

    const interval = setInterval(() => {
      void checkForUpdate();
    }, CHECK_INTERVAL_MS);

    return () => {
      window.removeEventListener(UPDATE_EVENT_NAME, onManualUpdate);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, [checkForUpdate]);

  const refreshApp = useCallback(() => {
    // Hard reload to pull the fresh client bundle. Auth token remains preserved.
    window.location.reload();
  }, []);

  return {
    hasUpdate,
    latestVersion,
    refreshApp,
    checkForUpdate,
  };
}
