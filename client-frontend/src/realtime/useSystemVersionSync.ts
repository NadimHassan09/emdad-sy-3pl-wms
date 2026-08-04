import { useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import type { Socket } from 'socket.io-client';

import { clearStoredBearer, getStoredBearer } from '../services/authStorage';
import {
  CLIENT_ALWAYS_ACTIVE,
  resolveClientActiveModule,
  type ClientAppModuleId,
} from './module-route-map';
import { CLIENT_MODULE_QUERY_KEYS } from './module-query-map';
import { socketHttpOrigin } from './socketBaseUrl';

export const SYSTEM_VERSION_EVENT = 'system.version';

type SystemVersionPayload = {
  version?: number;
  modules?: string[];
};

function disposeModule(qc: QueryClient, moduleId: ClientAppModuleId): void {
  for (const key of CLIENT_MODULE_QUERY_KEYS[moduleId] ?? []) {
    void qc.removeQueries({ queryKey: key as QueryKey });
  }
}

function refetchModule(qc: QueryClient, moduleId: ClientAppModuleId): void {
  for (const key of CLIENT_MODULE_QUERY_KEYS[moduleId] ?? []) {
    void qc.invalidateQueries({ queryKey: key as QueryKey });
  }
}

/**
 * Architecture 2.2 — single client sync listener for `system.version`.
 */
export function useClientSystemVersionSync(socket: Socket | null): void {
  const qc = useQueryClient();
  const location = useLocation();
  const activeRef = useRef<ClientAppModuleId | null>(null);
  const inflight = useRef<Set<string>>(new Set());
  const trailing = useRef<Set<string>>(new Set());

  useEffect(() => {
    const next = resolveClientActiveModule(location.pathname);
    const prev = activeRef.current;
    if (prev && prev !== next && !CLIENT_ALWAYS_ACTIVE.includes(prev)) {
      disposeModule(qc, prev);
    }
    if (next && next !== prev) {
      refetchModule(qc, next);
    }
    activeRef.current = next;
  }, [location.pathname, qc]);

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
            try {
              const origin = socketHttpOrigin();
              const token = getStoredBearer();
              const res = await fetch(`${origin}/api/auth/me`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                credentials: 'include',
              });
              if (res.status === 401 || res.status === 403) {
                clearStoredBearer();
                window.location.assign('/login');
                return;
              }
            } catch {
              /* ignore network */
            }
          }
          refetchModule(qc, moduleId as ClientAppModuleId);
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
        if (CLIENT_ALWAYS_ACTIVE.includes(m as ClientAppModuleId) || m === active) {
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
