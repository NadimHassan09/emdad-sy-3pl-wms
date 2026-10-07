import { Bell, CheckCheck } from 'lucide-react'
import { useNavigate } from 'react-router'
import { formatRelative, useUiPreferences } from '@emdad/core'
import { cn } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@emdad/ui/ui/popover'
import { useClientNotifications } from '@/hooks/useClientNotifications'
import { clientNotificationHref } from '@/services/clientNotificationsService'

export function NotificationsMenu() {
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const { items, unreadCount, markRead, markAllRead } = useClientNotifications()
  const navigate = useNavigate()
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={t('Notifications', 'الإشعارات')}>
          <Bell aria-hidden />
          {unreadCount > 0 ? (
            <span className="absolute -end-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-xs font-semibold leading-5 text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="flex w-96 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden p-0"
      >
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">{t('Notifications', 'الإشعارات')}</p>
          <Button variant="ghost" size="sm" disabled={unreadCount === 0} onClick={() => void markAllRead()}>
            <CheckCheck aria-hidden />
            {t('Mark all read', 'تحديد الكل كمقروء')}
          </Button>
        </div>
        <div className="max-h-80 min-h-0 overflow-y-auto overscroll-contain">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t('No notifications', 'لا توجد إشعارات')}</p>
          ) : (
            <ul className="divide-y">
              {items.slice(0, 12).map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={cn('flex w-full items-start gap-3 px-4 py-3 text-start hover:bg-muted/60', !n.isRead && 'bg-brand-50')}
                    onClick={() => {
                      if (!n.isRead) void markRead(n.id)
                      const href = clientNotificationHref(n)
                      if (href) navigate(href)
                    }}
                  >
                    <span aria-hidden className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.isRead ? 'bg-transparent' : 'bg-primary')} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{n.title}</span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{formatRelative(n.createdAt, locale)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="shrink-0 border-t p-2">
          <Button variant="ghost" className="w-full" onClick={() => navigate('/notifications')}>
            {t('View all notifications', 'عرض كل الإشعارات')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
