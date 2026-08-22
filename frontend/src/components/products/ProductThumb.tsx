/**
 * Compact product thumbnail for order planning tables.
 * Uses a deterministic local photo when a product is selected; empty state shows a box icon.
 */

function thumbIndex(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  // Only use the solid local photo assets (1.webp / 3.webp).
  return h % 2 === 0 ? 1 : 3;
}

export function ProductThumbWithFallback({
  productId,
  name,
  size = 'md',
}: {
  productId?: string | null;
  name?: string | null;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? 'h-9 w-9' : 'h-10 w-10';

  if (!productId) {
    return (
      <div
        className={`${dim} shrink-0 rounded-lg border border-border bg-surface-sunken flex items-center justify-center text-text-faint`}
        aria-hidden
      >
        <i className="fa-solid fa-box text-xs" />
      </div>
    );
  }

  const src = `/product-thumbs/${thumbIndex(productId)}.webp`;
  const initials = (name ?? '?').trim().slice(0, 2).toUpperCase() || '?';

  return (
    <span className={`relative inline-flex ${dim} shrink-0`}>
      <img
        src={src}
        alt={name?.trim() || 'Product'}
        className={`${dim} rounded-lg border border-border object-cover bg-surface-sunken`}
        loading="lazy"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
          const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
          if (fb) fb.hidden = false;
        }}
      />
      <span
        hidden
        className={`${dim} absolute inset-0 rounded-lg border border-border bg-brand-50 flex items-center justify-center text-brand-700 text-[10px] font-bold`}
        aria-hidden
      >
        {initials}
      </span>
    </span>
  );
}
