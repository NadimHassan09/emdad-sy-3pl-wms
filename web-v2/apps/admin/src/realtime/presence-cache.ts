import type { QueryClient } from '@tanstack/react-query';

import { QK } from '../constants/query-keys';

export type PresenceUser = {
  userId: string;
  role: string;
  companyId: string | null;
  connectedAt: string;
  disconnectedAt?: string;
  email?: string | null;
};

export function patchPresenceOnline(qc: QueryClient, presence: PresenceUser): void {
  qc.setQueryData<Set<string>>(QK.presenceOnlineUsers, (prev) => {
    const next = new Set(prev ?? []);
    next.add(presence.userId);
    return next;
  });
}

export function patchPresenceOffline(qc: QueryClient, presence: PresenceUser): void {
  qc.setQueryData<Set<string>>(QK.presenceOnlineUsers, (prev) => {
    const next = new Set(prev ?? []);
    next.delete(presence.userId);
    return next;
  });
}

export function isUserOnline(qc: QueryClient, userId: string): boolean {
  const set = qc.getQueryData<Set<string>>(QK.presenceOnlineUsers);
  return set?.has(userId) ?? false;
}
