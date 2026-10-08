export type BatchMemberSnapshot = {
  status: string;
  outboundStatus?: string | null;
  issueNote?: string | null;
};

const ISSUE_STATUSES = new Set(['failed_delivery', 'cancelled', 'rejected', 'returned']);
const DONE_STATUSES = new Set(['delivered', 'completed']);
const SHIPPED_STATUSES = new Set(['out_for_delivery', 'shipped']);
const DELIVERED_STATUSES = new Set(['delivered', 'completed']);

export type BatchSummary = {
  orderCount: number;
  completedCount: number;
  issueCount: number;
  pendingCount: number;
  /** Active members (same as orderCount for active-only lists). */
  selectedCount: number;
  pickedCount: number;
  packedCount: number;
  readyToShipCount: number;
  shippedCount: number;
  deliveredCount: number;
  stageKey: string | null;
  stageKind: 'operational' | 'status' | 'mixed' | 'empty';
};

function operationalKey(member: BatchMemberSnapshot): string | null {
  if (member.status !== 'processing') return null;
  const outbound = member.outboundStatus ?? '';
  if (
    outbound === 'picking' ||
    outbound === 'draft' ||
    outbound === 'allocated' ||
    outbound === 'pending_approval' ||
    outbound === 'confirmed' ||
    outbound === 'pending_stock'
  ) {
    return 'picking';
  }
  if (outbound === 'packing') return 'packing';
  if (outbound === 'waiting_for_shipping_method' || outbound === 'waiting_for_shipping_details') {
    return 'shipping_details';
  }
  if (outbound === 'packed' || outbound === 'ready_to_ship') return 'dispatch';
  return 'processing';
}

/** True when the member has progressed past picking into packing or later. */
function isPicked(member: BatchMemberSnapshot): boolean {
  if (DONE_STATUSES.has(member.status) || SHIPPED_STATUSES.has(member.status)) return true;
  if (member.status !== 'processing') return false;
  const outbound = member.outboundStatus ?? '';
  return (
    outbound === 'packing' ||
    outbound === 'waiting_for_shipping_method' ||
    outbound === 'waiting_for_shipping_details' ||
    outbound === 'packed' ||
    outbound === 'ready_to_ship' ||
    outbound === 'shipped'
  );
}

/** True when packing is done (ready for / past shipping details). */
function isPacked(member: BatchMemberSnapshot): boolean {
  if (DONE_STATUSES.has(member.status) || SHIPPED_STATUSES.has(member.status)) return true;
  if (member.status !== 'processing') return false;
  const outbound = member.outboundStatus ?? '';
  return (
    outbound === 'waiting_for_shipping_method' ||
    outbound === 'waiting_for_shipping_details' ||
    outbound === 'packed' ||
    outbound === 'ready_to_ship' ||
    outbound === 'shipped'
  );
}

function isReadyToShip(member: BatchMemberSnapshot): boolean {
  if (member.status === 'ready_to_ship') return true;
  if (member.status !== 'processing') return false;
  const outbound = member.outboundStatus ?? '';
  return outbound === 'packed' || outbound === 'ready_to_ship';
}

export function isBatchIssue(member: BatchMemberSnapshot): boolean {
  return Boolean(member.issueNote?.trim()) || ISSUE_STATUSES.has(member.status);
}

export function summarizeBatchMembers(members: BatchMemberSnapshot[]): BatchSummary {
  const orderCount = members.length;
  const completedCount = members.filter((member) => DONE_STATUSES.has(member.status)).length;
  const issueCount = members.filter(isBatchIssue).length;
  const pendingCount = Math.max(0, orderCount - completedCount);
  const selectedCount = orderCount;
  const pickedCount = members.filter(isPicked).length;
  const packedCount = members.filter(isPacked).length;
  const readyToShipCount = members.filter(isReadyToShip).length;
  const shippedCount = members.filter(
    (member) => SHIPPED_STATUSES.has(member.status) || member.outboundStatus === 'shipped',
  ).length;
  const deliveredCount = members.filter((member) => DELIVERED_STATUSES.has(member.status)).length;

  if (orderCount === 0) {
    return {
      orderCount,
      completedCount,
      issueCount,
      pendingCount,
      selectedCount,
      pickedCount,
      packedCount,
      readyToShipCount,
      shippedCount,
      deliveredCount,
      stageKey: null,
      stageKind: 'empty',
    };
  }

  const keys = members.map((member) => operationalKey(member) ?? member.status);
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  const tied = ranked.filter((entry) => entry[1] === top[1]).length > 1;
  if (tied) {
    return {
      orderCount,
      completedCount,
      issueCount,
      pendingCount,
      selectedCount,
      pickedCount,
      packedCount,
      readyToShipCount,
      shippedCount,
      deliveredCount,
      stageKey: null,
      stageKind: 'mixed',
    };
  }
  const stageKey = top[0];
  const operational = new Set(['picking', 'packing', 'shipping_details', 'dispatch', 'processing']);
  return {
    orderCount,
    completedCount,
    issueCount,
    pendingCount,
    selectedCount,
    pickedCount,
    packedCount,
    readyToShipCount,
    shippedCount,
    deliveredCount,
    stageKey,
    stageKind: operational.has(stageKey) ? 'operational' : 'status',
  };
}
