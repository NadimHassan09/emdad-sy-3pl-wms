/** Statuses where the client may still edit or remove an order. Once the admin approves, only the admin may change it. */
export const CLIENT_EDITABLE_OMS_STATUSES: ReadonlySet<string> = new Set([
  'draft',
  'waiting_for_confirmation',
  'pending_approval',
  'confirmed_waiting_for_admin_approval',
]);

/** Statuses where a client may delete the order outright (not yet confirmed by the client). */
export const CLIENT_DELETABLE_OMS_STATUSES: ReadonlySet<string> = new Set(['draft', 'waiting_for_confirmation']);

export function clientLockMessage(status: string): string {
  return `This order is ${status.replace(/_/g, ' ')} and was already approved by the warehouse. Ask the warehouse to change it.`;
}
