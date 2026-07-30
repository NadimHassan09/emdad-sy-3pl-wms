import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Alert, Button, EmptyState } from '@ds';

import { ClientPageIntro } from '../components/ClientPageIntro';
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
const UNREAD_FILTER_STORAGE_KEY = 'client-notifications-filter';

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
    Page: 'صفحة',
    of: 'من',
    Today: 'اليوم',
    Yesterday: 'أمس',
    Earlier: 'أقدم',
    'Filter applies to the current page only.': 'الفلتر يطبّق على الصفحة الحالية فقط.',
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

function dayBucket(iso: string, t: (s: string) => string): string {
  const d = new Date(iso);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startToday - startThat) / 86_400_000);
  if (diffDays === 0) return t('Today');
  if (diffDays === 1) return t('Yesterday');
  return t('Earlier');
}

type FilterMode = 'all' | 'unread' | 'read';

function parseFilterMode(raw: string | null): FilterMode {
  if (raw === 'unread' || raw === 'read' || raw === 'all') return raw;
  return 'all';
}

function readStoredFilter(): FilterMode {
  try {
    return parseFilterMode(window.localStorage.getItem(UNREAD_FILTER_STORAGE_KEY));
  } catch {
    return 'all';
  }
}

export function NotificationsPage(): ReactElement {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const isArabic = isClientArabic();
  const t = (label: string) => notificationsLabel(label, isArabic);

  const [page, setPage] = useState(0);
  const filterFromUrl = parseFilterMode(searchParams.get('filter'));
  const [filter, setFilter] = useState<FilterMode>(() => {
    const fromUrl = parseFilterMode(
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('filter')
        : null,
    );
    return fromUrl !== 'all' ? fromUrl : readStoredFilter();
  });

  useEffect(() => {
    if (filterFromUrl !== filter && searchParams.has('filter')) {
      setFilter(filterFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync URL → state only when URL filter changes
  }, [filterFromUrl]);

  useEffect(() => {
    try {
      window.localStorage.setItem(UNREAD_FILTER_STORAGE_KEY, filter);
    } catch {
      /* ignore */
    }
    const next = new URLSearchParams(searchParams);
    if (filter === 'all') next.delete('filter');
    else next.set('filter', filter);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- persist filter; avoid looping on searchParams identity
  }, [filter, setSearchParams]);

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
    },
  });

  const filteredItems = useMemo(() => {
    const items = listQuery.data?.items ?? [];
    if (filter === 'unread') return items.filter((n) => !n.isRead);
    if (filter === 'read') return items.filter((n) => n.isRead);
    return items;
  }, [listQuery.data?.items, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, ClientNotification[]>();
    for (const item of filteredItems) {
      const key = dayBucket(item.createdAt, t);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [filteredItems, isArabic]);

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
      <ClientPageIntro
        title={t('Notifications')}
        description={
          unreadCount > 0 ? (
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-bold text-white">
                {unreadCount}
              </span>
              <span>{t('Unread')}</span>
            </span>
          ) : undefined
        }
        actions={
          unreadCount > 0 ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void markAllMutation.mutateAsync()}
              disabled={markAllMutation.isPending}
            >
              {t('Mark all read')}
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t('Notifications')}>
        {(['all', 'unread', 'read'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={filter === mode}
            className={`min-h-8 rounded-full px-3 py-1 text-xs font-semibold transition ${
              filter === mode
                ? 'bg-brand-600 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
            onClick={() => setFilter(mode)}
          >
            {t(mode === 'all' ? 'All' : mode === 'unread' ? 'Unread' : 'Read')}
            {mode === 'unread' && unreadCount > 0 ? ` · ${unreadCount}` : ''}
          </button>
        ))}
      </div>
      {filter !== 'all' ? (
        <p className="text-xs text-[var(--text-muted)]">
          {t('Filter applies to the current page only.')}
        </p>
      ) : null}

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

      <section className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-xs)]">
        {listQuery.isPending ? (
          <div className="space-y-2 p-3.5" aria-busy="true">
            <div className="h-14 animate-pulse rounded-lg bg-neutral-100" />
            <div className="h-14 animate-pulse rounded-lg bg-neutral-100" />
            <div className="h-14 animate-pulse rounded-lg bg-neutral-100" />
            <span className="sr-only">{t('Loading notifications…')}</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<i className="fa-regular fa-bell text-2xl" aria-hidden="true" />}
              title={t('No notifications yet')}
              description={t('Notifications from your warehouse team appear here.')}
            />
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {grouped.map(([bucket, items]) => (
              <div key={bucket}>
                <div className="bg-[var(--surface-raised)] px-3.5 py-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    {bucket}
                  </p>
                </div>
                <ul className="m-0 list-none p-0">
                  {items.map((item) => (
                    <li key={item.id} className="border-t border-[var(--border-subtle)] first:border-t-0">
                      <button
                        type="button"
                        className={`flex w-full gap-3 px-3.5 py-3 text-start transition hover:bg-[var(--surface-hover)] ${
                          !item.isRead ? 'bg-brand-50/50' : ''
                        }`}
                        onClick={() => void onItemClick(item)}
                      >
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                            item.isRead ? 'bg-transparent' : 'bg-brand-600'
                          }`}
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={`text-sm leading-snug ${
                                item.isRead
                                  ? 'font-medium text-[var(--text-base)]'
                                  : 'font-semibold text-[var(--text-strong)]'
                              }`}
                            >
                              {item.title}
                            </span>
                            <span className="shrink-0 text-[10px] tabular-nums text-[var(--text-faint)]">
                              {formatNotificationTime(item.createdAt, isArabic)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-muted)]">
                            {item.body}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {total > PAGE_SIZE ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] px-3.5 py-2.5">
            <p className="text-xs text-[var(--text-muted)]">
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
