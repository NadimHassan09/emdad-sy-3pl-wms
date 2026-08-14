import { adminMediaSrc } from '../lib/admin-media';

type Props = {
  name?: string | null;
  imageUrl?: string | null;
};

/** Product name with thumbnail (or box placeholder). */
export function ProductNameCell({ name, imageUrl }: Props) {
  const imageSrc = adminMediaSrc(imageUrl);
  const label = name?.trim() || '—';
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {imageSrc ? (
        <img
          src={imageSrc}
          alt=""
          className="h-8 w-8 shrink-0 rounded-lg border border-border object-cover"
        />
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-text-faint">
          <i className="fa-solid fa-box text-[10px]" aria-hidden="true" />
        </div>
      )}
      <span className="truncate font-medium text-text-strong">{label}</span>
    </div>
  );
}
