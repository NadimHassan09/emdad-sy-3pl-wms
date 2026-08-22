import { type ReactElement, type ReactNode, useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import { useAuth } from '../auth/AuthContext';
import { getStoredBearer } from '../services/authStorage';
import { socketHttpOrigin } from './socketBaseUrl';
import { useClientSystemVersionSync } from './useSystemVersionSync';

type Props = { children: ReactNode };

/**
 * Client portal realtime (Architecture 2.2 Phase 3): exactly one sync listener — `system.version`.
 * Tenant isolation is enforced by company room membership on the socket.
 */
export function RealtimeProvider({ children }: Props): ReactElement {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const token = getStoredBearer();
    const companyId = user?.companyId;
    if (!user || !token || !companyId) {
      setSocket((prev) => {
        prev?.disconnect();
        return null;
      });
      return;
    }

    const next = io(`${socketHttpOrigin()}/realtime`, {
      auth: { token, companyId },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
    });
    setSocket(next);

    return () => {
      next.disconnect();
      setSocket((prev) => (prev === next ? null : prev));
    };
  }, [user]);

  useClientSystemVersionSync(socket);

  return <>{children}</>;
}
