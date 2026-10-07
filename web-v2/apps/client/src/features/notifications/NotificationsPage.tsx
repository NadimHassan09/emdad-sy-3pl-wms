import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { formatRelative, useUiPreferences } from '@emdad/core'
import { EmptyState, ErrorState, PageHeader, cn, useNavigate } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { Skeleton } from '@emdad/ui/ui/skeleton'
import { useCachedState } from '@/hooks/useCachedState'
import { CLIENT_NOTIFICATIONS_QUERY_KEY } from '@/hooks/useClientNotifications'
import {
  clientNotificationHref,
  fetchClientNotifications,
  markAllClientNotificationsRead,
  markClientNotificationRead,
  type ClientNotification,
} from '@/services/clientNotificationsService'

type FilterMode = 'all' | 'unread' | 'read'

const PAGE_SIZE = 20

function dayBucket(iso: string, t: (en: string, ar: string) => string): string {
  const d = new Date(iso)
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((startToday - startThat) / 86_400_000)
  if (diffDays === 0) return t('Today', 'اليوم')
  if (diffDays === 1) return t('Yesterday', 'أمس')
  return t('Earlier', 'أقدم')
}

export function NotificationsPage() {
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [page, setPage] = useCachedState('notifications-page', 0)
  const [filter, setFilter] = useCachedState<FilterMode>('notifications-filter', 'all')

  const listQuery = useQuery({
    queryKey: [...CLIENT_NOTIFICATIONS_QUERY_KEY, 'page', page, PAGE_SIZE],
    queryFn: () => fetchClientNotifications({ limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
  })

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markClientNotificationRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CLIENT_NOTIFICATIONS_QUERY_KEY })
    },
  })

  const markAllMutation = useMutation({
    mutationFn: () => markAllClientNotificationsRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CLIENT_NOTIFICATIONS_QUERY_KEY })
    },
  })

  const filteredItems = useMemo(() => {
    const items = listQuery.data?.items ?? []
    if (filter === 'unread') return items.filter((n) => !n.isRead)
    if (filter === 'read') return items.filter((n) => n.isRead)
    return items
  }, [listQuery.data?.items, filter])

  const grouped = useMemo(() => {
    const map = new Map<string, ClientNotification[]>()
    for (const item of filteredItems) {
      const key = dayBucket(item.createdAt, t)
      const list = map.get(key) ?? []
      list.push(item)
      map.set(key, list)
    }
    return [...map.entries()]
  }, [filteredItems, isArabic]) // eslint-disable-line react-hooks/exhaustive-deps

  const total = listQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const unreadCount = listQuery.data?.unreadCount ?? 0

  async function onItemClick(notification: ClientNotification): Promise<void> {
    if (!notification.isRead) {
      await markReadMutation.mutateAsync(notification.id)
    }
    const href = clientNotificationHref(notification)
    if (href) navigate(href)
  }

  function onFilterChange(next: FilterMode): void {
    setFilter(next)
    setPage(0)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title={t('Notifications', 'الإشعارات')}
        description={
          unreadCount > 0 ? `${unreadCount} ${t('unread', 'غير مقروء')}` : undefined
        }
        actions={
          unreadCount > 0 ? (
            <Button
              variant="outline"
              disabled={markAllMutation.isPending}
              onClick={() => void markAllMutation.mutateAsync()}
            >
              {t('Mark all read', 'تعليم الكل كمقروء')}
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('Notifications', 'الإشعارات')}>
        {(['all', 'unread', 'read'] as const).map((mode) => (
          <Button
            key={mode}
            type="button"
            size="sm"
            role="tab"
            aria-selected={filter === mode}
            variant={filter === mode ? 'default' : 'outline'}
            onClick={() => onFilterChange(mode)}
          >
            {t(
              mode === 'all' ? 'All' : mode === 'unread' ? 'Unread' : 'Read',
              mode === 'all' ? 'الكل' : mode === 'unread' ? 'غير مقروء' : 'مقروء',
            )}
            {mode === 'unread' && unreadCount > 0 ? ` · ${unreadCount}` : ''}
          </Button>
        ))}
      </div>

      {listQuery.isError ? (
        <ErrorState
          title={t('Could not load notifications', 'تعذر تحميل الإشعارات')}
          description={(listQuery.error as Error).message}
          retryLabel={t('Retry', 'إعادة المحاولة')}
          onRetry={() => void listQuery.refetch()}
        />
      ) : null}

      <section className="overflow-hidden rounded-xl border bg-card">
        {listQuery.isPending ? (
          <div className="space-y-2 p-4" aria-busy>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : filteredItems.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={t('No notifications yet', 'لا توجد إشعارات بعد')}
            description={t(
              'Notifications from your warehouse team appear here.',
              'إشعارات فريق المستودع تظهر هنا.',
            )}
          />
        ) : (
          <div className="divide-y">
            {grouped.map(([bucket, items]) => (
              <div key={bucket}>
                <div className="bg-muted/40 px-4 py-1.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {bucket}
                  </p>
                </div>
                <ul className="m-0 list-none divide-y p-0">
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={cn(
                          'flex w-full gap-3 px-4 py-3 text-start transition hover:bg-muted/50',
                          !item.isRead && 'bg-primary/5',
                        )}
                        onClick={() => void onItemClick(item)}
                      >
                        <span
                          className={cn(
                            'mt-2 size-2 shrink-0 rounded-full',
                            item.isRead ? 'bg-transparent' : 'bg-primary',
                          )}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={cn(
                                'text-sm leading-snug',
                                item.isRead ? 'font-medium' : 'font-semibold',
                              )}
                            >
                              {item.title}
                            </span>
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                              {formatRelative(item.createdAt, locale)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-sm text-muted-foreground">{item.body}</p>
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
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {t('Page', 'صفحة')} {page + 1} {t('of', 'من')} {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                {t('Previous', 'السابق')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('Next', 'التالي')}
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}
