import { createPortal } from 'react-dom';
import { useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';

const MENU_MIN_WIDTH = 140;
const MENU_GAP_PX = 4;
const VIEWPORT_PAD = 8;

function findScrollParent(from: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null = from;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      return node;
    }
    node = node.parentElement;
  }
  return document.getElementById('main-content');
}

export function AnchoredDropdown({
  open,
  trigger,
  children,
  align = 'end',
  menuClassName = '',
  menuRootProps,
  /** When true, adds bottom padding to the scroll parent so the menu is reachable by scrolling. */
  extendScroll = true,
}: {
  open: boolean;
  trigger: ReactNode;
  children: ReactNode;
  /** Horizontal alignment relative to the trigger. */
  align?: 'start' | 'end';
  menuClassName?: string;
  /** Props on the portaled menu root (e.g. data-* for click-outside). */
  menuRootProps?: HTMLAttributes<HTMLDivElement> & {
    [key: `data-${string}`]: string | undefined;
  };
  extendScroll?: boolean;
}) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const scrollPadRef = useRef<{ el: HTMLElement; prev: string } | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const clearScrollPad = () => {
    if (scrollPadRef.current) {
      scrollPadRef.current.el.style.paddingBottom = scrollPadRef.current.prev;
      scrollPadRef.current = null;
    }
  };

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      clearScrollPad();
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

      const top = rect.bottom + MENU_GAP_PX;

      left = Math.max(
        VIEWPORT_PAD,
        Math.min(left, window.innerWidth - MENU_MIN_WIDTH - VIEWPORT_PAD),
      );

      setCoords({ top, left });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
      clearScrollPad();
    };
  }, [open, align]);

  useLayoutEffect(() => {
    if (!open || !extendScroll || !coords) {
      clearScrollPad();
      return;
    }

    const applyScrollPad = () => {
      clearScrollPad();
      const menuEl = menuRef.current;
      const triggerEl = triggerRef.current;
      if (!menuEl) return;

      const menuRect = menuEl.getBoundingClientRect();
      const overflow = menuRect.bottom - window.innerHeight + VIEWPORT_PAD;
      if (overflow <= 0) return;

      const scrollParent = findScrollParent(triggerEl);
      if (!scrollParent) return;

      const prev = scrollParent.style.paddingBottom;
      scrollParent.style.paddingBottom = `${overflow}px`;
      scrollPadRef.current = { el: scrollParent, prev };
    };

    applyScrollPad();

    const menuEl = menuRef.current;
    if (!menuEl) return;

    const ro = new ResizeObserver(applyScrollPad);
    ro.observe(menuEl);
    window.addEventListener('resize', applyScrollPad);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', applyScrollPad);
      clearScrollPad();
    };
  }, [open, extendScroll, coords, children]);

  const menu =
    open && coords ? (
      <div
        ref={menuRef}
        role="menu"
        className={[
          'fixed z-[200] min-w-[140px] overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg',
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
