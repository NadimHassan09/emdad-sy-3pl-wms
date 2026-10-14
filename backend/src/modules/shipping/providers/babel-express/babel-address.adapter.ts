import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../common/prisma/prisma.service';
import babelAddressIndex from '../../../../data/syria-locations/babel-address-index.json';

const INDEX_SEP = '\u001f';

type BabelAddressIndex = {
  entries?: Record<string, number>;
};

/**
 * Maps the unified OMS address (Governorate / City-Region / Town-Neighborhood)
 * onto Babel Express neighbourhood ids using the local babel_* snapshot tables,
 * then the bundled address index when the snapshot is empty or the area name
 * does not match Babel's area (warehouse rows often store the neighbourhood
 * in the district field).
 *
 * Snapshot is refreshed via BabelGeoSyncService — not a live Babel UI dependency.
 * Other carriers get their own adapters against the same unified address names.
 */
export function lookupBabelNeighbourhoodIdFromIndex(
  index: BabelAddressIndex,
  input: { governorate: string; cityRegion: string; townNeighborhood: string },
): number | null {
  const entries = index.entries ?? {};
  const exact = entries[[input.governorate, input.cityRegion, input.townNeighborhood].join(INDEX_SEP)];
  if (typeof exact === 'number' && Number.isFinite(exact)) return exact;

  const hits: number[] = [];
  for (const [key, id] of Object.entries(entries)) {
    const parts = key.split(INDEX_SEP);
    if (parts.length < 3) continue;
    if (parts[0] !== input.governorate || parts[2] !== input.townNeighborhood) continue;
    if (parts[1] !== input.cityRegion && input.cityRegion !== input.townNeighborhood) continue;
    if (typeof id !== 'number' || !Number.isFinite(id)) continue;
    hits.push(id);
  }
  return hits.length === 1 ? hits[0] : null;
}

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

    const fromDb = await this.resolveFromSnapshot(gov, area, hood);
    if (fromDb != null) return fromDb;

    return lookupBabelNeighbourhoodIdFromIndex(babelAddressIndex, {
      governorate: gov,
      cityRegion: area,
      townNeighborhood: hood,
    });
  }

  private async resolveFromSnapshot(
    gov: string,
    area: string,
    hood: string,
  ): Promise<number | null> {
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
