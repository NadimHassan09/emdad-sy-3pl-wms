import { useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import type { Socket } from 'socket.io-client';

import { router } from '../router';
import {
  ADMIN_ALWAYS_ACTIVE,
  resolveAdminActiveModule,
  type AdminAppModuleId,
} from './module-route-map';
import { ADMIN_MODULE_QUERY_KEYS } from './module-query-map';

export const SYSTEM_VERSION_EVENT = 'system.version';

type SystemVersionPayload = {
  version?: number;
  modules?: string[];
};

function disposeModule(qc: QueryClient, moduleId: AdminAppModuleId): void {
  for (const key of ADMIN_MODULE_QUERY_KEYS[moduleId] ?? []) {
    void qc.removeQueries({ queryKey: key as QueryKey });
  }
}

function refetchModule(qc: QueryClient, moduleId: AdminAppModuleId): void {
  for (const key of ADMIN_MODULE_QUERY_KEYS[moduleId] ?? []) {
    void qc.invalidateQueries({ queryKey: key as QueryKey });
  }
}

/**
 * Architecture 2.2 — single admin sync listener for `system.version`.
 * Uses data-router subscription so it works outside `<RouterProvider>` children.
 */
export function useAdminSystemVersionSync(socket: Socket | null): void {
  const qc = useQueryClient();
  const activeRef = useRef<AdminAppModuleId | null>(null);
  const inflight = useRef<Set<string>>(new Set());
  const trailing = useRef<Set<string>>(new Set());

  useEffect(() => {
    const applyPath = (pathname: string): void => {
      const next = resolveAdminActiveModule(pathname);
      const prev = activeRef.current;
      if (prev && prev !== next && !ADMIN_ALWAYS_ACTIVE.includes(prev)) {
        disposeModule(qc, prev);
      }
      if (next && next !== prev) {
        refetchModule(qc, next);
      }
      activeRef.current = next;
    };

    applyPath(router.state.location.pathname);
    return router.subscribe((state) => {
      applyPath(state.location.pathname);
    });
  }, [qc]);

  useEffect(() => {
    if (!socket) return;

    const runModule = (moduleId: string): void => {
      if (inflight.current.has(moduleId)) {
        trailing.current.add(moduleId);
        return;
      }
      inflight.current.add(moduleId);
      void (async () => {
        try {
          if (moduleId === 'session') {
            window.dispatchEvent(
              new CustomEvent('wms:session-changed', {
                detail: { type: 'revalidate', reason: 'system.version' },
              }),
            );
          }
          refetchModule(qc, moduleId as AdminAppModuleId);
        } finally {
          inflight.current.delete(moduleId);
          if (trailing.current.has(moduleId)) {
            trailing.current.delete(moduleId);
            runModule(moduleId);
          }
        }
      })();
    };

    const onSystemVersion = (payload: SystemVersionPayload): void => {
      const modules = Array.isArray(payload?.modules) ? payload.modules : [];
      const active = activeRef.current;
      for (const m of modules) {
        // Presence is hydrated via dedicated socket patches + connect snapshot.
        if (m === 'presence') continue;
        if (ADMIN_ALWAYS_ACTIVE.includes(m as AdminAppModuleId) || m === active) {
          runModule(m);
        }
      }
    };

    socket.on(SYSTEM_VERSION_EVENT, onSystemVersion);
    return () => {
      socket.off(SYSTEM_VERSION_EVENT, onSystemVersion);
    };
  }, [socket, qc]);
}
