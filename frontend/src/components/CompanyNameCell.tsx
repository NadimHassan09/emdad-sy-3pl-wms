import { adminMediaSrc } from '../lib/admin-media';

type Props = {
  name?: string | null;
  logoUrl?: string | null;
};

/** Client name with company logo (or building placeholder). */
export function CompanyNameCell({ name, logoUrl }: Props) {
  const logoSrc = adminMediaSrc(logoUrl);
  const label = name?.trim() || '—';
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {logoSrc ? (
        <img
          src={logoSrc}
          alt=""
          className="h-8 w-8 shrink-0 rounded-lg border border-border object-cover"
        />
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-text-faint">
          <i className="fa-solid fa-building text-[10px]" aria-hidden="true" />
        </div>
      )}
      <span className="truncate font-medium text-text-strong">{label}</span>
    </div>
  );
}
