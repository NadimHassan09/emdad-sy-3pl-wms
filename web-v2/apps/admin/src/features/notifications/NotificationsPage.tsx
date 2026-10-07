import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatRelative, useUiPreferences } from '@emdad/core'
import { PageHeader, useNavigate } from '@emdad/ui'
import { Alert, AlertDescription } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { Skeleton } from '@emdad/ui/ui/skeleton'
import { cn } from '@emdad/ui'
import { Bell } from 'lucide-react'
import { QK } from '@/constants/query-keys'
import { useCachedState } from '@/hooks/useCachedState'
import {
  fetchNotificationsPage,
  markAllNotificationsRead,
  markNotificationRead,
  notificationHref,
  type AppNotification,
} from '@/services/notificationsService'

type NotificationReadFilter = 'all' | 'unread' | 'read'

function readFilterToQuery(filter: NotificationReadFilter): boolean | undefined {
  if (filter === 'unread') return false
  if (filter === 'read') return true
  return undefined
}

const PAGE_SIZE = 20

export function NotificationsPage() {
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [page, setPage] = useCachedState('notifications-page', 0)
  const [filter, setFilter] = useCachedState<NotificationReadFilter>('notifications-filter', 'all')

  const listQuery = useQuery({
    queryKey: QK.notifications.list({ page, filter, pageSize: PAGE_SIZE }),
    queryFn: () =>
      fetchNotificationsPage({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        isRead: readFilterToQuery(filter),
      }),
  })

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: QK.notifications.all }),
  })

  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: QK.notifications.all }),
  })

  const items = listQuery.data?.items ?? []
  const total = listQuery.data?.total ?? 0
  const unreadCount = listQuery.data?.unreadCount ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  async function onItemClick(notification: AppNotification): Promise<void> {
    if (!notification.isRead) {
      await markReadMutation.mutateAsync(notification.id)
    }
    const href = notificationHref(notification)
    if (href) navigate(href)
  }

  function onFilterChange(next: NotificationReadFilter): void {
    setFilter(next)
    setPage(0)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title={t('Notifications', 'الإشعارات')}
        description={unreadCount > 0 ? `${unreadCount} ${t('unread', 'غير مقروء')}` : undefined}
        actions={
          unreadCount > 0 ? (
            <Button variant="outline" disabled={markAllMutation.isPending} onClick={() => void markAllMutation.mutateAsync()}>
              {t('Mark all read', 'تعليم الكل كمقروء')}
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2">
        {(['all', 'unread', 'read'] as const).map((mode) => (
          <Button
            key={mode}
            type="button"
            size="sm"
            variant={filter === mode ? 'default' : 'outline'}
            onClick={() => onFilterChange(mode)}
          >
            {t(mode === 'all' ? 'All' : mode === 'unread' ? 'Unread' : 'Read', mode === 'all' ? 'الكل' : mode === 'unread' ? 'غير مقروء' : 'مقروء')}
          </Button>
        ))}
      </div>

      {listQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{t('Could not load notifications.', 'تعذر التحميل.')}</AlertDescription>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => listQuery.refetch()}>
            {t('Retry', 'إعادة')}
          </Button>
        </Alert>
      ) : null}

      <section className="overflow-hidden rounded-xl border bg-card">
        {listQuery.isPending ? (
          <div className="space-y-2 p-4" aria-busy>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <Bell className="mx-auto size-8 text-muted-foreground" aria-hidden />
            <p className="mt-3 font-medium">{t('No notifications yet', 'لا إشعارات')}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('Alerts from orders and warehouse workflows appear here.', 'تظهر تنبيهات الطلبات هنا.')}
            </p>
          </div>
        ) : (
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
                    className={cn('mt-2 size-2 shrink-0 rounded-full', item.isRead ? 'bg-transparent' : 'bg-primary')}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className={cn('text-sm leading-snug', item.isRead ? 'font-medium' : 'font-semibold')}>
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
        )}

        {total > PAGE_SIZE ? (
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
            <Button type="button" variant="outline" size="sm" disabled={page <= 0} onClick={() => setPage(page - 1)}>
              {t('Previous', 'السابق')}
            </Button>
            <span className="text-muted-foreground">
              {t('Page', 'صفحة')} {page + 1} {t('of', 'من')} {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              {t('Next', 'التالي')}
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  )
}
