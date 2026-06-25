export const TOPBAR_DROPDOWN_VIEWPORT_PAD = 16;
export const TOPBAR_DROPDOWN_OFFSET = 8;

export function clampTopbarDropdownLeft(triggerRect: DOMRect, menuWidth: number): number {
  const isRtl = document.documentElement.dir === 'rtl';
  let left: number;

  if (isRtl) {
    left = triggerRect.left;
  } else {
    left = triggerRect.right - menuWidth;
  }

  const maxLeft = window.innerWidth - menuWidth - TOPBAR_DROPDOWN_VIEWPORT_PAD;
  return Math.max(TOPBAR_DROPDOWN_VIEWPORT_PAD, Math.min(left, maxLeft));
}

export function topbarDropdownTop(triggerRect: DOMRect): number {
  return triggerRect.bottom + TOPBAR_DROPDOWN_OFFSET;
}
