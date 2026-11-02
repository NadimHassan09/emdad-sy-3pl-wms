/**
 * Merge Sila cargo snapshots into CarrierShipment.rawResultMeta without
 * dropping Emdad-owned keys such as pending-cancel state and COD collection.
 */

export const EMDAD_OWNED_META_KEYS = [
  'silaCancel',
  'silaEventSyncAt',
  'shippingError',
  'reusedExistingAwb',
  'codCollection',
  'awbPendingReassignment',
  'previousAwb',
  'courierHistory',
  'babelLookup',
] as const;

export type SilaCancelState =
  | 'pending_confirmation'
  | 'cancelled'
  | 'already_cancelled'
  | 'refused'
  | 'retry';

export type SilaCancelMeta = {
  state: SilaCancelState;
  courierCancel?: string;
  errorCode?: string;
  message?: string;
  retryAfterSeconds?: number;
  at: string;
};

export function asMetaRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

export function readSilaCancelMeta(raw: unknown): SilaCancelMeta | null {
  const record = asMetaRecord(raw).silaCancel;
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  const state = (record as SilaCancelMeta).state;
  if (!state) return null;
  return record as SilaCancelMeta;
}

/**
 * Copy cargo/tracking fields onto previous meta.
 * Keeps `silaCancel` and `codCollection` unless `patch` sets them explicitly
 * (including `silaCancel: null` to clear after a verified final cancel).
 */
export function mergeShipmentRawMeta(
  previous: unknown,
  patch: unknown,
): Record<string, unknown> {
  const prev = asMetaRecord(previous);
  const nextPatch = asMetaRecord(patch);
  const next = { ...prev, ...nextPatch };

  if ('silaCancel' in nextPatch) {
    if (nextPatch.silaCancel == null) {
      delete next.silaCancel;
    }
  } else if (prev.silaCancel !== undefined) {
    next.silaCancel = prev.silaCancel;
  }

  if (!('codCollection' in nextPatch) && prev.codCollection !== undefined) {
    next.codCollection = prev.codCollection;
  }

  for (const key of EMDAD_OWNED_META_KEYS) {
    if (key === 'silaCancel' || key === 'codCollection') continue;
    if (!(key in nextPatch) && prev[key] !== undefined) {
      next[key] = prev[key];
    }
  }

  return next;
}

/**
 * After a confirmed carrier AWB is stored, overwrite leftover cargo label fields so
 * waybill extractors cannot keep the previous courier's `remote_label_code`.
 */
export function applyConfirmedCarrierAwbToMeta(
  meta: Record<string, unknown>,
  awb: string,
): Record<string, unknown> {
  const trimmed = awb.trim();
  if (!trimmed) return meta;
  const next: Record<string, unknown> = {
    ...meta,
    courier_barcode: trimmed,
  };
  const rows = Array.isArray(meta.shipments) ? [...meta.shipments] : [];
  if (rows.length > 0 && rows[0] && typeof rows[0] === 'object' && !Array.isArray(rows[0])) {
    rows[0] = {
      ...(rows[0] as Record<string, unknown>),
      remote_label_code: trimmed,
      remote_barcode: trimmed,
    };
    next.shipments = rows;
  }
  return next;
}

export function withSilaCancelMeta(
  previous: unknown,
  cargo: unknown,
  silaCancel: SilaCancelMeta | null,
): Record<string, unknown> {
  return mergeShipmentRawMeta(previous, {
    ...asMetaRecord(cargo),
    silaCancel,
  });
}
