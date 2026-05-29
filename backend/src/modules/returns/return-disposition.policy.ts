import { BadRequestException } from '@nestjs/common';
import { ReturnItemDisposition, StockStatus } from '@prisma/client';

import {
  isAdjustmentStockLocationType,
  isQuarantineStorageLocationType,
} from '../../common/constants/storage-location-types';

/** Dispositions that require a follow-up inspect before inventory post. */
export const PENDING_INSPECTION_DISPOSITIONS: ReturnItemDisposition[] = [
  ReturnItemDisposition.inspection_required,
];

/** Dispositions that post inventory when applied. */
export const INVENTORY_POSTING_DISPOSITIONS: ReturnItemDisposition[] = [
  ReturnItemDisposition.restock,
  ReturnItemDisposition.quarantine,
  ReturnItemDisposition.damaged,
  ReturnItemDisposition.discard,
  ReturnItemDisposition.scrap,
];

export function isPendingInspectionDisposition(
  disposition: ReturnItemDisposition | null | undefined,
): boolean {
  return !!disposition && PENDING_INSPECTION_DISPOSITIONS.includes(disposition);
}

export function isInventoryPostingDisposition(
  disposition: ReturnItemDisposition | null | undefined,
): boolean {
  if (!disposition) return false;
  if (disposition === ReturnItemDisposition.scrap) return true;
  return INVENTORY_POSTING_DISPOSITIONS.includes(disposition);
}

export function normalizeReturnDisposition(
  disposition: ReturnItemDisposition,
): ReturnItemDisposition {
  return disposition === ReturnItemDisposition.scrap
    ? ReturnItemDisposition.discard
    : disposition;
}

export function stockStatusForDisposition(
  disposition: ReturnItemDisposition,
): StockStatus {
  switch (normalizeReturnDisposition(disposition)) {
    case ReturnItemDisposition.restock:
      return StockStatus.available;
    case ReturnItemDisposition.quarantine:
    case ReturnItemDisposition.damaged:
      return StockStatus.quarantined;
    case ReturnItemDisposition.discard:
      return StockStatus.quarantined;
    default:
      return StockStatus.available;
  }
}

export function assertLocationAllowedForDisposition(
  disposition: ReturnItemDisposition,
  locationType: string,
): void {
  const d = normalizeReturnDisposition(disposition);

  if (d === ReturnItemDisposition.restock) {
    if (!['internal', 'fridge'].includes(locationType)) {
      throw new BadRequestException(
        'Restock returns must target sellable storage (internal or fridge).',
      );
    }
    return;
  }

  if (d === ReturnItemDisposition.quarantine || d === ReturnItemDisposition.damaged) {
    if (!isQuarantineStorageLocationType(locationType)) {
      throw new BadRequestException(
        'Quarantine/damaged returns must target quarantine or scrap isolation bins.',
      );
    }
    return;
  }

  if (d === ReturnItemDisposition.discard) {
    if (locationType !== 'scrap') {
      throw new BadRequestException('Discard returns must target a scrap location.');
    }
    return;
  }

  if (!isAdjustmentStockLocationType(locationType)) {
    throw new BadRequestException('Invalid location type for return disposition.');
  }
}
