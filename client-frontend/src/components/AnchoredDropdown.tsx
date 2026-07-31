import { createPortal } from 'react-dom';
import { useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';

const MENU_MIN_WIDTH = 160;
const MENU_GAP_PX = 4;
const VIEWPORT_PAD = 8;

/**
 * Portaled dropdown anchored to a trigger — same pattern as admin
 * AnchoredDropdown, styled for the Client Portal.
 */
export function AnchoredDropdown({
  open,
  trigger,
  children,
  align = 'end',
  menuClassName = '',
  menuRootProps,
}: {
  open: boolean;
  trigger: ReactNode;
  children: ReactNode;
  align?: 'start' | 'end';
  menuClassName?: string;
  menuRootProps?: HTMLAttributes<HTMLDivElement> & {
    [key: `data-${string}`]: string | undefined;
  };
}) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }

    const updatePosition = () => {
      const el = triggerRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const isRtl = document.documentElement.dir === 'rtl';

      let left =
        align === 'end'
          ? isRtl
            ? rect.left
            : rect.right - MENU_MIN_WIDTH
          : isRtl
            ? rect.right - MENU_MIN_WIDTH
            : rect.left;

      left = Math.max(
        VIEWPORT_PAD,
        Math.min(left, window.innerWidth - MENU_MIN_WIDTH - VIEWPORT_PAD),
      );

      setCoords({ top: rect.bottom + MENU_GAP_PX, left });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, align]);

  const menu =
    open && coords ? (
      <div
        ref={menuRef}
        role="menu"
        className={[
          'fixed z-[200] min-w-[160px] overflow-hidden rounded-xl border border-border bg-surface-panel shadow-soft py-1',
          menuClassName,
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ top: coords.top, left: coords.left }}
        {...menuRootProps}
      >
        {children}
      </div>
    ) : null;

  return (
    <>
      <div ref={triggerRef} className="inline-flex">
        {trigger}
      </div>
      {typeof document !== 'undefined' && menu ? createPortal(menu, document.body) : null}
    </>
  );
}
