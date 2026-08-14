/** Public media path consumed by `clientMediaSrc` / admin media helpers. */
export function toAvatarPublicUrl(avatarPath: string | null | undefined): string | null {
  if (!avatarPath?.trim()) return null;
  const cleaned = avatarPath.trim().replace(/^\/+/, '');
  return `/media/${cleaned}`;
}
