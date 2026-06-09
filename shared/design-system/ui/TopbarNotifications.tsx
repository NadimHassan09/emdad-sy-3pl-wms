/**
 * TopbarNotifications — bell trigger + portaled dropdown list.
 */

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { unlockNotificationAudio } from '../lib/notification-sound';
import { cn } from './cn';
import {
  clampTopbarDropdownLeft,
  topbarDropdownTop,
} from './topbar-dropdown-utils';

const MENU_WIDTH = 360;

export interface TopbarNotificationItem {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface TopbarNotificationsProps {
  items: TopbarNotificationItem[];
  unreadCount: number;
  loading?: boolean;
  title?: string;
  emptyLabel?: string;
  markAllReadLabel?: string;
  viewAllLabel?: string;
  viewAllHref?: string;
  onViewAll?: () => void;
  onItemClick?: (item: TopbarNotificationItem) => void;
  onMarkAllRead?: () => void;
  formatTime?: (iso: string) => string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function clampMenuLeft(triggerRect: DOMRect, menuWidth: number): number {
  return clampTopbarDropdownLeft(triggerRect, menuWidth);
}

function defaultFormatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function NotificationsDropdown({
  menuId,
  title,
  items,
  loading,
  emptyLabel,
  markAllReadLabel,
  viewAllLabel,
  viewAllHref,
  onViewAll,
  unreadCount,
  position,
  onClose,
  onItemClick,
  onMarkAllRead,
  formatTime,
}: {
  menuId: string;
  title: string;
  items: TopbarNotificationItem[];
  loading?: boolean;
  emptyLabel: string;
  markAllReadLabel: string;
  viewAllLabel?: string;
  viewAllHref?: string;
  onViewAll?: () => void;
  unreadCount: number;
  position: { top: number; left: number };
  onClose: () => void;
  onItemClick?: (item: TopbarNotificationItem) => void;
  onMarkAllRead?: () => void;
  formatTime: (iso: string) => string;
}) {
  const showMarkAll = unreadCount > 0 && onMarkAllRead !== undefined;

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-[calc(var(--z-dropdown)-1)] cursor-default bg-transparent"
        aria-label="Close notifications"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        id={menuId}
        role="menu"
        className={cn(
          'fixed z-[var(--z-dropdown)]',
          'w-[360px] max-w-[calc(100vw-2rem)]',
          'overflow-hidden rounded-2xl',
          'border border-neutral-200/90 bg-white',
          'shadow-xl shadow-neutral-900/10',
          'animate-[fadein_120ms_ease-out]',
        )}
        style={{ top: position.top, left: position.left }}
      >
        <div className="flex items-center justify-between gap-2 border-b border-neutral-100 bg-neutral-50/80 px-4 py-3">
          <p className="text-sm font-semibold text-neutral-900">{title}</p>
          {showMarkAll && (
            <button
              type="button"
              className="shrink-0 text-xs font-semibold text-brand-700 hover:text-brand-800"
              onClick={() => {
                onMarkAllRead();
              }}
            >
              {markAllReadLabel}
            </button>
          )}
        </div>

        <div className="max-h-[min(24rem,70vh)] overflow-y-auto">
          {loading && items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-neutral-500">…</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-neutral-500">{emptyLabel}</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    role="menuitem"
                    className={cn(
                      'flex w-full flex-col gap-0.5 px-4 py-3 text-start',
                      'transition-colors duration-fast hover:bg-neutral-50',
                      !item.isRead && 'bg-brand-50/40',
                    )}
                    onClick={() => {
                      onItemClick?.(item);
                      onClose();
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={cn(
                          'text-sm leading-snug',
                          item.isRead ? 'font-medium text-neutral-800' : 'font-semibold text-neutral-900',
                        )}
                      >
                        {item.title}
                      </span>
                      <span className="shrink-0 text-[10px] text-neutral-400 tabular-nums">
                        {formatTime(item.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-neutral-600 line-clamp-2">{item.body}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {(viewAllHref || onViewAll) && viewAllLabel ? (
          <div className="border-t border-neutral-100 bg-neutral-50/80 px-4 py-2.5 text-center">
            {viewAllHref ? (
              <a
                href={viewAllHref}
                className="text-xs font-semibold text-brand-700 hover:text-brand-800 hover:underline"
                onClick={onClose}
              >
                {viewAllLabel}
              </a>
            ) : (
              <button
                type="button"
                className="text-xs font-semibold text-brand-700 hover:text-brand-800"
                onClick={() => {
                  onViewAll?.();
                  onClose();
                }}
              >
                {viewAllLabel}
              </button>
            )}
          </div>
        ) : null}
      </div>
    </>,
    document.body,
  );
}

export function TopbarNotifications({
  items,
  unreadCount,
  loading,
  title = 'Notifications',
  emptyLabel = 'No notifications yet',
  markAllReadLabel = 'Mark all read',
  viewAllLabel,
  viewAllHref,
  onViewAll,
  onItemClick,
  onMarkAllRead,
  formatTime = defaultFormatTime,
  open: openProp,
  onOpenChange,
}: TopbarNotificationsProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const close = () => setOpen(false);
  const badge = unreadCount > 99 ? '99+' : String(unreadCount);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    function updatePosition() {
      const rect = triggerRef.current!.getBoundingClientRect();
      setMenuPos({
        top: topbarDropdownTop(rect),
        left: clampMenuLeft(rect, MENU_WIDTH),
      });
    }

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          'relative inline-flex h-9 w-9 items-center justify-center',
          'border-0 bg-transparent shadow-none',
          'transition-opacity duration-fast hover:opacity-80',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30',
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={unreadCount > 0 ? `${title}, ${unreadCount} unread` : title}
        onClick={() => {
          unlockNotificationAudio();
          setOpen(!open);
        }}
      >
        <i className="fa-solid fa-bell text-lg text-white" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -end-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white"
            style={{ backgroundColor: '#ef4444' }}
          >
            {badge}
          </span>
        )}
      </button>

      {open && (
        <NotificationsDropdown
          menuId={menuId}
          title={title}
          items={items}
          loading={loading}
          emptyLabel={emptyLabel}
          markAllReadLabel={markAllReadLabel}
          viewAllLabel={viewAllLabel}
          viewAllHref={viewAllHref}
          onViewAll={onViewAll}
          unreadCount={unreadCount}
          position={menuPos}
          onClose={close}
          onItemClick={onItemClick}
          onMarkAllRead={onMarkAllRead}
          formatTime={formatTime}
        />
      )}
    </div>
  );
}
