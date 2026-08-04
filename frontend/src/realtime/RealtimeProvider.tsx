import { useQueryClient } from '@tanstack/react-query';
import { type ReactElement, type ReactNode, useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import { useAuth } from '../auth/AuthContext';
import { getAccessToken } from '../auth/authStorage';
import { getApiBaseUrl } from '../api/apiBaseUrl';
import { QK } from '../constants/query-keys';
import { useTenantCompanyId } from '../hooks/useTenantCompanyId';
import { RealtimeEvents } from './constants';
import {
  patchPresenceOffline,
  patchPresenceOnline,
  type PresenceUser,
} from './presence-cache';
import { socketHttpOrigin } from './socketBaseUrl';
import { useAdminSystemVersionSync } from './useSystemVersionSync';

type Props = { children: ReactNode };

async function fetchOnlinePresenceIds(): Promise<Set<string>> {
  const token = getAccessToken();
  if (!token) return new Set();
  try {
    const res = await fetch(`${getApiBaseUrl()}/realtime/presence/online`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    });
    if (!res.ok) return new Set();
    const body = (await res.json()) as { data?: { userIds?: string[] } };
    return new Set(body.data?.userIds ?? []);
  } catch {
    return new Set();
  }
}

/**
 * Admin realtime (Architecture 2.2): `system.version` for module sync.
 * Presence uses dedicated online/offline events (live indicator state, not Module Versions payloads).
 */
export function RealtimeProvider({ children }: Props): ReactElement {
  const { user } = useAuth();
  const qc = useQueryClient();
  const companyId = useTenantCompanyId();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!user || !token) {
      setSocket((prev) => {
        prev?.disconnect();
        return null;
      });
      return;
    }

    const next = io(`${socketHttpOrigin()}/realtime`, {
      auth: {
        token,
        ...(companyId ? { companyId } : {}),
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
    });
    setSocket(next);

    const hydratePresence = (): void => {
      void fetchOnlinePresenceIds().then((ids) => {
        qc.setQueryData(QK.presenceOnlineUsers, ids);
      });
      window.dispatchEvent(
        new CustomEvent('wms:session-changed', { detail: { type: 'revalidate' } }),
      );
    };

    const onPresenceOnline = (payload: { presence?: PresenceUser }): void => {
      if (payload?.presence) patchPresenceOnline(qc, payload.presence);
    };
    const onPresenceOffline = (payload: { presence?: PresenceUser }): void => {
      if (payload?.presence) patchPresenceOffline(qc, payload.presence);
    };
    const onAuthSessionChanged = (payload: {
      type?: string;
      userId?: string;
      reason?: string;
    }): void => {
      if (!payload?.type || !payload.userId) return;
      if (
        payload.userId === user.id &&
        (payload.type === 'forced_logout' ||
          payload.type === 'expired' ||
          payload.type === 'logout')
      ) {
        window.dispatchEvent(
          new CustomEvent('wms:session-changed', {
            detail: { type: payload.type, reason: payload.reason },
          }),
        );
      }
    };

    next.on('connect', hydratePresence);
    next.on(RealtimeEvents.PRESENCE_ONLINE, onPresenceOnline);
    next.on(RealtimeEvents.PRESENCE_OFFLINE, onPresenceOffline);
    next.on(RealtimeEvents.AUTH_SESSION_CHANGED, onAuthSessionChanged);

    return () => {
      next.off('connect', hydratePresence);
      next.off(RealtimeEvents.PRESENCE_ONLINE, onPresenceOnline);
      next.off(RealtimeEvents.PRESENCE_OFFLINE, onPresenceOffline);
      next.off(RealtimeEvents.AUTH_SESSION_CHANGED, onAuthSessionChanged);
      next.disconnect();
      setSocket((prev) => (prev === next ? null : prev));
    };
  }, [user, companyId, qc]);

  useAdminSystemVersionSync(socket);

  return <>{children}</>;
}
