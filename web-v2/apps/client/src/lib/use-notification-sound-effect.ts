import { useEffect, useRef } from 'react';

import { playNotificationSound } from './notification-sound';

export type NotificationSoundItem = {
  id: string;
  isRead: boolean;
};

/**
 * Plays the pop sound when a new unread notification appears (by id),
 * not only when the unread count increases.
 */
export function useNotificationSoundEffect(
  items: NotificationSoundItem[] | undefined,
): void {
  const seenUnreadIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    const unread = (items ?? []).filter((n) => !n.isRead);
    const currentIds = new Set(unread.map((n) => n.id));

    if (seenUnreadIdsRef.current !== null) {
      const hasNew = [...currentIds].some((id) => !seenUnreadIdsRef.current!.has(id));
      if (hasNew) playNotificationSound();
    }

    seenUnreadIdsRef.current = currentIds;
  }, [items]);
}
