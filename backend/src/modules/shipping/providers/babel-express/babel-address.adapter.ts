import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../common/prisma/prisma.service';

/**
 * Maps the unified OMS address (Governorate / City-Region / Town-Neighborhood)
 * onto Babel Express neighbourhood ids using the local babel_* snapshot tables.
 *
 * Snapshot is refreshed via BabelGeoSyncService — not a live Babel UI dependency.
 * Other carriers get their own adapters against the same unified address names.
 */
@Injectable()
export class BabelAddressAdapter {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve Babel neighbourhood id from unified hierarchy names.
   * Returns null when the place is outside Babel coverage (other carriers may still ship).
   */
  async resolveNeighbourhoodId(input: {
    governorate?: string | null;
    cityRegion?: string | null;
    townNeighborhood?: string | null;
  }): Promise<number | null> {
    const gov = input.governorate?.trim();
    const area = input.cityRegion?.trim();
    const hood = input.townNeighborhood?.trim();
    if (!gov || !area || !hood) return null;

    const city = await this.prisma.babelCity.findFirst({
      where: { name: gov },
      select: { id: true },
    });
    if (!city) return null;

    const babelArea = await this.prisma.babelArea.findFirst({
      where: { cityId: city.id, name: area },
      select: { id: true },
    });
    if (!babelArea) return null;

    const neighbourhood = await this.prisma.babelNeighbourhood.findFirst({
      where: { areaId: babelArea.id, name: hood },
      select: { id: true },
    });
    return neighbourhood?.id ?? null;
  }

  async isBabelCovered(input: {
    governorate?: string | null;
    cityRegion?: string | null;
    townNeighborhood?: string | null;
  }): Promise<boolean> {
    return (await this.resolveNeighbourhoodId(input)) != null;
  }
}
