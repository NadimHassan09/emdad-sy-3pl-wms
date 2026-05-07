import { BadRequestException } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';

/** Blocks inbound/outbound usage for non-active catalogue rows. */
export function assertProductOrderableForOrders(status: ProductStatus): void {
  if (status === 'suspended') {
    throw new BadRequestException(
      'This product is suspended and cannot be used on inbound or outbound orders.',
    );
  }
  if (status === 'archived') {
    throw new BadRequestException(
      'This product is archived and cannot be used on inbound or outbound orders.',
    );
  }
}
