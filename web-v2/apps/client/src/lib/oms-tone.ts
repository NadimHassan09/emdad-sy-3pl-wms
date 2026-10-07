import type { Tone } from '@emdad/ui'
import { mapClientOmsCommercialDisplayStatus, type ClientOmsCommercialDisplayStatus } from './client-oms-commercial-status'

/** Client-portal OMS status → tone (same mapping as the admin portal, kept local so the apps stay independent). */
const MAP: Record<ClientOmsCommercialDisplayStatus, Tone> = {
  waiting_for_confirmation: 'pending',
  confirmed_waiting_for_admin_approval: 'warning',
  processing: 'progress',
  ready_to_ship: 'ready',
  shipped: 'transit',
  delivered: 'success',
  failed_delivery: 'danger',
  returned: 'returned',
  cancelled: 'neutral',
  legacy: 'neutral',
}

export const clientOmsStatusTone = (status: string): Tone => MAP[mapClientOmsCommercialDisplayStatus(status)]
