import { useMemo, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Alert, Button, EmptyState } from '@ds';

import { isClientArabic } from '../lib/client-ui-language';
import { CLIENT_NOTIFICATIONS_QUERY_KEY } from '../hooks/useClientNotifications';
import {
  clientNotificationHref,
  fetchClientNotifications,
  markAllClientNotificationsRead,
  markClientNotificationRead,
  type ClientNotification,
} from '../services/clientNotificationsService';

const PAGE_SIZE = 20;

function notificationsLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    Notifications: 'الإشعارات',
    'Mark all read': 'تعليم الكل كمقروء',
    Unread: 'غير مقروء',
    Read: 'مقروء',
    All: 'الكل',
    'Could not load notifications': 'تعذر تحميل الإشعارات',
    'No notifications yet': 'لا توجد إشعارات بعد',
    'Notifications from your warehouse team appear here.':
      'إشعارات فريق المستودع تظهر هنا.',
    'Loading notifications…': 'جاري تحميل الإشعارات…',
    Previous: 'السابق',
    Next: 'التالي',
    'Page': 'صفحة',
    of: 'من',
  };
  return ar[label] ?? label;
}

function formatNotificationTime(iso: string, isArabic: boolean): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return isArabic ? 'الآن' : 'Just now';
  if (mins < 60) return isArabic ? `منذ ${mins} د` : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return isArabic ? `منذ ${hours} س` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return isArabic ? `منذ ${days} ي` : `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

type FilterMode = 'all' | 'unread' | 'read';

export function NotificationsPage(): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isArabic = isClientArabic();
  const t = (label: string) => notificationsLabel(label, isArabic);

  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<FilterMode>('all');

  const listQuery = useQuery({
    queryKey: ['client', 'notifications', 'page', page, PAGE_SIZE],
    queryFn: () => fetchClientNotifications({ limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markClientNotificationRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['client', 'notifications'] });
      void queryClient.invalidateQueries({ queryKey: CLIENT_NOTIFICATIONS_QUERY_KEY });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => markAllClientNotificationsRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['client', 'notifications'] });
      void queryClient.invalidateQueries({ queryKey: CLIENT_NOTIFICATIONS_QUERY_KEY });
    },
  });

  const filteredItems = useMemo(() => {
    const items = listQuery.data?.items ?? [];
    if (filter === 'unread') return items.filter((n) => !n.isRead);
    if (filter === 'read') return items.filter((n) => n.isRead);
    return items;
  }, [listQuery.data?.items, filter]);

  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const unreadCount = listQuery.data?.unreadCount ?? 0;

  async function onItemClick(notification: ClientNotification): Promise<void> {
    if (!notification.isRead) {
      await markReadMutation.mutateAsync(notification.id);
    }
    const href = clientNotificationHref(notification);
    if (href) navigate(href);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">{t('Notifications')}</h1>
          {unreadCount > 0 ? (
            <p className="text-sm text-slate-500">
              {unreadCount} {t('Unread').toLowerCase()}
            </p>
          ) : null}
        </div>
        {unreadCount > 0 ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void markAllMutation.mutateAsync()}
            disabled={markAllMutation.isPending}
          >
            {t('Mark all read')}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'unread', 'read'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filter === mode
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            onClick={() => setFilter(mode)}
          >
            {t(mode === 'all' ? 'All' : mode === 'unread' ? 'Unread' : 'Read')}
          </button>
        ))}
      </div>

      {listQuery.isError ? (
        <Alert
          variant="error"
          title={t('Could not load notifications')}
          action={
            <Alert.Action variant="error" onClick={() => listQuery.refetch()}>
              Retry
            </Alert.Action>
          }
        />
      ) : null}

      <section className="card">
        {listQuery.isPending ? (
          <p className="muted">{t('Loading notifications…')}</p>
        ) : filteredItems.length === 0 ? (
          <EmptyState
            icon={<i className="fa-regular fa-bell text-2xl" aria-hidden="true" />}
            title={t('No notifications yet')}
            description={t('Notifications from your warehouse team appear here.')}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {filteredItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`flex w-full flex-col gap-1 px-1 py-4 text-start transition hover:bg-slate-50 ${
                    !item.isRead ? 'bg-emerald-50/30' : ''
                  }`}
                  onClick={() => void onItemClick(item)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`text-sm leading-snug ${
                        item.isRead ? 'font-medium text-slate-800' : 'font-semibold text-slate-900'
                      }`}
                    >
                      {item.title}
                    </span>
                    <span className="shrink-0 text-[10px] text-slate-400 tabular-nums">
                      {formatNotificationTime(item.createdAt, isArabic)}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-600">{item.body}</p>
                </button>
              </li>
            ))}
          </ul>
        )}

        {total > PAGE_SIZE ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-500">
              {t('Page')} {page + 1} {t('of')} {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                {t('Previous')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('Next')}
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
