import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '../../components/Button';
import { QK } from '../../constants/query-keys';
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

  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<NotificationReadFilter>('all');

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
            onClick={() => onFilterChange(mode)}
          >
            {t(mode === 'all' ? 'All' : mode === 'unread' ? 'Unread' : 'Read')}
          </button>
        ))}
      </div>

      {listQuery.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-medium">{t('Could not load notifications')}</p>
          <Button variant="secondary" size="sm" className="mt-2" onClick={() => listQuery.refetch()}>
            {t('Retry')}
          </Button>
        </div>
      ) : null}

      <section className="card">
        {listQuery.isPending ? (
          <p className="muted">{t('Loading notifications…')}</p>
        ) : items.length === 0 ? (
          <div className="py-8 text-center">
            <i className="fa-regular fa-bell mb-3 text-3xl text-slate-300" aria-hidden="true" />
            <p className="font-medium text-slate-800">{t('No notifications yet')}</p>
            <p className="mt-1 text-sm text-slate-500">
              {t('Alerts from orders, billing, and warehouse workflows appear here.')}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`flex w-full flex-col gap-1 px-1 py-4 text-start transition hover:bg-slate-50 ${
                    !item.isRead ? 'bg-emerald-50/40' : ''
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
                      {formatAdminNotificationTime(item.createdAt, isArabic)}
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
