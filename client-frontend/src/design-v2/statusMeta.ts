/**
 * Re-export shared status meta so Client Portal and Admin stay in sync.
 * Prefer importing from `@ds` in new code.
 */
export {
  statusMeta,
  normalizeStatusKey,
  statusLabel,
  type StatusMeta,
} from '../../../shared/design-system-next/lib/statusMeta';
