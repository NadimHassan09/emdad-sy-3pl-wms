/** Read pick/pack draft location ids from warehouse task execution_state JSON. */

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Pick drop-off stored on `pick_draft.packingDestinationId`. */
export function readPickDraftPackingDestinationId(raw: unknown): string | null {
  if (!isRecord(raw)) return null;
  const d = raw.pick_draft ?? raw.pickDraft;
  if (!isRecord(d)) return null;
  const id = d.packingDestinationId ?? d.packing_destination_id;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

/** Pack station stored on `pack_draft.packingStationId`. */
export function readPackDraftPackingStationId(raw: unknown): string | null {
  if (!isRecord(raw)) return null;
  const d = raw.pack_draft ?? raw.packDraft;
  if (!isRecord(d)) return null;
  const id = d.packingStationId ?? d.packing_station_id;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}
