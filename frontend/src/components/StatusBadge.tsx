import { normalizeStatusKey, statusLabel, statusMeta } from '@ds';

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const isArabic =
    typeof document !== 'undefined' &&
    (document.documentElement.dir === 'rtl' || window.localStorage.getItem('wms-ui-language') === 'AR');
  const key = normalizeStatusKey(status);
  const meta = statusMeta[key] ?? statusMeta.draft;
  const label = statusLabel(status, isArabic);

  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.bg} ${meta.text} ${meta.border}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}
