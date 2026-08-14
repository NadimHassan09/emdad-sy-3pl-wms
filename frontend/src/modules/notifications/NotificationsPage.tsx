import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { AdminListPageShell } from '../../components/AdminListPageShell';
import { Button } from '../../components/Button';
import { QK } from '../../constants/query-keys';
import { useCachedState } from '../../hooks/useCachedState';
import {
  adminNotificationHref,
  formatAdminNotificationTime,
  readFilterToQuery,
  type NotificationReadFilter,
} from './notification-links';
import {
  fetchNotificationsPage,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '../../services/notificationsService';

const PAGE_SIZE = 20;

function pageLabel(isArabic: boolean) {
  return (key: string): string => {
    if (!isArabic) return key;
    const ar: Record<string, string> = {
      Notifications: 'الإشعارات',
      'Mark all read': 'تعليم الكل كمقروء',
      Unread: 'غير مقروء',
      Read: 'مقروء',
      All: 'الكل',
      'Could not load notifications': 'تعذر تحميل الإشعارات',
      'No notifications yet': 'لا توجد إشعارات بعد',
      'Alerts from orders, billing, and warehouse workflows appear here.':
        'تظهر هنا تنبيهات الطلبات والفوترة وسير العمل.',
      'Loading notifications…': 'جاري تحميل الإشعارات…',
      Previous: 'السابق',
      Next: 'التالي',
      Page: 'صفحة',
      of: 'من',
      Retry: 'إعادة المحاولة',
    };
    return ar[key] ?? key;
  };
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isArabic =
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = pageLabel(isArabic);

  const [page, setPage] = useCachedState('page', 0);
  const [filter, setFilter] = useCachedState<NotificationReadFilter>('filter', 'all');

  const listQuery = useQuery({
    queryKey: QK.notifications.list({ page, filter, pageSize: PAGE_SIZE }),
    queryFn: () =>
      fetchNotificationsPage({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        isRead: readFilterToQuery(filter),
      }),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QK.notifications.all });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QK.notifications.all });
    },
  });

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const unreadCount = listQuery.data?.unreadCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function onItemClick(notification: AppNotification): Promise<void> {
    if (!notification.isRead) {
      await markReadMutation.mutateAsync(notification.id);
    }
    const href = adminNotificationHref(notification);
    if (href) navigate(href);
  }

  function onFilterChange(next: NotificationReadFilter): void {
    setFilter(next);
    setPage(0);
  }

  return (
    <AdminListPageShell
      icon="fa-bell"
      title={t('Notifications')}
      subtitle={unreadCount > 0 ? `${unreadCount} ${t('Unread').toLowerCase()}` : undefined}
      isArabic={isArabic}
      className="mx-auto max-w-7xl space-y-5 animate-enter"
    >
      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'unread', 'read'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filter === mode
                ? 'bg-brand-600 text-white'
                : 'bg-surface-card-muted text-text-body hover:bg-surface-hover'
            }`}
            onClick={() => onFilterChange(mode)}
          >
            {t(mode === 'all' ? 'All' : mode === 'unread' ? 'Unread' : 'Read')}
          </button>
        ))}
        {unreadCount > 0 ? (
          <button
            type="button"
            className="ms-auto rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => void markAllMutation.mutateAsync()}
            disabled={markAllMutation.isPending}
          >
            {t('Mark all read')}
          </button>
        ) : null}
      </div>

      {listQuery.isError ? (
        <div className="rounded-lg border border-status-danger-border bg-status-danger-bg px-4 py-3 text-sm text-status-danger-fg">
          <p className="font-medium">{t('Could not load notifications')}</p>
          <Button variant="secondary" size="sm" className="mt-2" onClick={() => listQuery.refetch()}>
            {t('Retry')}
          </Button>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[var(--radius-card)] border border-border-subtle bg-surface-card shadow-xs">
        {listQuery.isPending ? (
          <div className="space-y-2 p-3.5" aria-busy="true">
            <div className="h-14 animate-pulse rounded-lg bg-skeleton-base" />
            <div className="h-14 animate-pulse rounded-lg bg-skeleton-base" />
            <div className="h-14 animate-pulse rounded-lg bg-skeleton-base" />
            <span className="sr-only">{t('Loading notifications…')}</span>
          </div>
        ) : items.length === 0 ? (
          <div className="px-3.5 py-8 text-center">
            <i className="fa-regular fa-bell mb-3 text-3xl text-text-faint" aria-hidden="true" />
            <p className="font-medium text-text-body">{t('No notifications yet')}</p>
            <p className="mt-1 text-sm text-text-muted">
              {t('Alerts from orders, billing, and warehouse workflows appear here.')}
            </p>
          </div>
        ) : (
          <ul className="m-0 list-none divide-y divide-border-subtle p-0">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`flex w-full gap-3 px-3.5 py-3 text-start transition hover:bg-surface-hover ${
                    !item.isRead ? 'bg-brand-50/50 dark:bg-white/[0.03]' : ''
                  }`}
                  onClick={() => void onItemClick(item)}
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      item.isRead ? 'bg-transparent' : 'bg-brand-500 dark:bg-brand-400'
                    }`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`text-sm leading-snug ${
                          item.isRead
                            ? 'font-medium text-text-body'
                            : 'font-semibold text-text-strong'
                        }`}
                      >
                        {item.title}
                      </span>
                      <span className="shrink-0 text-[10px] tabular-nums text-text-faint">
                        {formatAdminNotificationTime(item.createdAt, isArabic)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-text-muted">{item.body}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {total > PAGE_SIZE ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle px-3.5 py-2.5">
            <p className="text-xs text-text-muted">
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
    </AdminListPageShell>
  );
}
