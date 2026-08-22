import { Injectable, Logger } from '@nestjs/common';
import { ShippingProviderConnectionStatus } from '@prisma/client';

import { EncryptionService } from '../../../../common/crypto/encryption.service';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { BABEL_EXPRESS_CODE } from '../../shipping.constants';
import { BabelExpressHttpClient } from './babel-express.http-client';

type SnapshotCity = { id: number; name: string };
type SnapshotArea = { id: number; cityId: number; name: string };
type SnapshotHood = { id: number; areaId: number; name: string };

/**
 * Refreshable snapshot of Babel geographic hierarchy.
 * Snapshot ≠ eternal truth — call syncFromBabel() after Babel coverage changes.
 *
 * HTTP calls run *outside* the DB transaction (Babel sync can take minutes).
 */
@Injectable()
export class BabelGeoSyncService {
  private readonly logger = new Logger(BabelGeoSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: BabelExpressHttpClient,
    private readonly encryption: EncryptionService,
  ) {}

  async syncFromBabel(): Promise<{
    cities: number;
    areas: number;
    neighbourhoods: number;
    syncedAt: string;
  }> {
    const credentials = await this.requireBabelCredentials();
    const syncedAt = new Date();

    const citiesRaw = await this.http.post<{
      cities?: Array<{ id: number; name: string }>;
    }>('getCities', credentials, {});
    const citiesSrc = citiesRaw.cities ?? [];

    const cities: SnapshotCity[] = [];
    const areas: SnapshotArea[] = [];
    const hoods: SnapshotHood[] = [];

    for (const city of citiesSrc) {
      cities.push({ id: city.id, name: city.name });
      const areasRaw = await this.http.post<{
        areas?: Array<{ id: number; name: string }>;
      }>('getAreas', credentials, { cityID: city.id });
      for (const area of areasRaw.areas ?? []) {
        areas.push({ id: area.id, cityId: city.id, name: area.name });
        const hoodsRaw = await this.http.post<{
          neighbourhoods?: Array<{ id: number; name: string }>;
        }>('getNeighbourhoods', credentials, { areaID: area.id });
        for (const hood of hoodsRaw.neighbourhoods ?? []) {
          hoods.push({ id: hood.id, areaId: area.id, name: hood.name });
        }
      }
    }

    // Persist snapshot in one replace pass (data already fetched).
    await this.prisma.$transaction(
      async (tx) => {
        await tx.babelNeighbourhood.deleteMany();
        await tx.babelArea.deleteMany();
        await tx.babelCity.deleteMany();
        if (cities.length) {
          await tx.babelCity.createMany({
            data: cities.map((c) => ({ ...c, syncedAt })),
          });
        }
        if (areas.length) {
          await tx.babelArea.createMany({
            data: areas.map((a) => ({ ...a, syncedAt })),
          });
        }
        if (hoods.length) {
          // Chunk to avoid oversized statements.
          const chunk = 500;
          for (let i = 0; i < hoods.length; i += chunk) {
            await tx.babelNeighbourhood.createMany({
              data: hoods.slice(i, i + chunk).map((h) => ({ ...h, syncedAt })),
            });
          }
        }
      },
      { timeout: 120_000 },
    );

    this.logger.log(
      `Babel geo snapshot refreshed: cities=${cities.length} areas=${areas.length} neighbourhoods=${hoods.length}`,
    );

    return {
      cities: cities.length,
      areas: areas.length,
      neighbourhoods: hoods.length,
      syncedAt: syncedAt.toISOString(),
    };
  }

  async listCities() {
    return this.prisma.babelCity.findMany({ orderBy: { name: 'asc' } });
  }

  async listAreas(cityId: number) {
    return this.prisma.babelArea.findMany({
      where: { cityId },
      orderBy: { name: 'asc' },
    });
  }

  async listNeighbourhoods(areaId: number) {
    return this.prisma.babelNeighbourhood.findMany({
      where: { areaId },
      orderBy: { name: 'asc' },
    });
  }

  async findNeighbourhoodById(id: number) {
    return this.prisma.babelNeighbourhood.findUnique({
      where: { id },
      include: { area: { include: { city: true } } },
    });
  }

  async snapshotMeta(): Promise<{
    cities: number;
    areas: number;
    neighbourhoods: number;
    lastSyncedAt: string | null;
  }> {
    const [cities, areas, neighbourhoods, latest] = await Promise.all([
      this.prisma.babelCity.count(),
      this.prisma.babelArea.count(),
      this.prisma.babelNeighbourhood.count(),
      this.prisma.babelCity.findFirst({ orderBy: { syncedAt: 'desc' } }),
    ]);
    return {
      cities,
      areas,
      neighbourhoods,
      lastSyncedAt: latest?.syncedAt?.toISOString() ?? null,
    };
  }

  private async requireBabelCredentials() {
    const provider = await this.prisma.shippingProvider.findUnique({
      where: { code: BABEL_EXPRESS_CODE },
      include: { connection: true },
    });
    const conn = provider?.connection;
    if (
      !conn ||
      conn.status !== ShippingProviderConnectionStatus.connected ||
      !conn.encryptedUsername ||
      !conn.encryptedPassword
    ) {
      throw new Error('Babel Express is not connected.');
    }
    return {
      username: this.encryption.decrypt(conn.encryptedUsername),
      password: this.encryption.decrypt(conn.encryptedPassword),
    };
  }
}
