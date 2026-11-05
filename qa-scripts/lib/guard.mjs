// Safety rules for anything that writes. Real customers' orders must never be touched.
export const TEST_CLIENT = 'Test company';
export const TEST_RECIPIENT = 'Nadim Hassan';
export const TEST_NOTE = 'TEST ORDER';

/** Throws unless the order record is clearly a test order. Call before every cancel/delete/edit. */
export function assertTestOrder(order) {
  const text = (v) => String(v ?? '').toLowerCase();
  const ok =
    text(order.client).includes(TEST_CLIENT.toLowerCase()) &&
    text(order.recipient).includes(TEST_RECIPIENT.toLowerCase()) &&
    text(order.notes).includes(TEST_NOTE.toLowerCase());
  if (!ok) {
    throw new Error(
      `REFUSED: order ${order.code ?? '?'} is not a test order (client/recipient/notes do not match). Nothing was changed.`,
    );
  }
}

/** After filtering a carrier portal by the order code, exactly one row must remain and it must carry the code. */
export function assertSingleMatch(rows, code) {
  const hits = rows.filter((r) => r.includes(code));
  if (rows.length !== 1 || hits.length !== 1) {
    throw new Error(
      `REFUSED: filtering by "${code}" left ${rows.length} row(s), ${hits.length} matching. Nothing was changed.`,
    );
  }
  return hits[0];
}

/** Writes are off unless QA_ALLOW_WRITES=1 is set on purpose. */
export function requireWriteMode() {
  if (process.env.QA_ALLOW_WRITES !== '1') {
    throw new Error('Read-only mode. Set QA_ALLOW_WRITES=1 to allow actions on TEST orders.');
  }
}
