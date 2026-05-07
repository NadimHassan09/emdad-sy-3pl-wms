import { BadRequestException } from '@nestjs/common';
import { LocationStatus } from '@prisma/client';

export function assertLocationUsableForInventoryMove(status: LocationStatus): void {
  if (status === LocationStatus.blocked) {
    throw new BadRequestException(
      'This location is suspended and cannot be used for inventory moves or tasks.',
    );
  }
  if (status === LocationStatus.archived) {
    throw new BadRequestException('This location is archived and cannot be used.');
  }
}
