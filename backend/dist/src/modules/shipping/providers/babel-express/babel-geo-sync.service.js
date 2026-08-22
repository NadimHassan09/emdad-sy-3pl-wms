"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var BabelGeoSyncService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BabelGeoSyncService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const encryption_service_1 = require("../../../../common/crypto/encryption.service");
const prisma_service_1 = require("../../../../common/prisma/prisma.service");
const shipping_constants_1 = require("../../shipping.constants");
const babel_express_http_client_1 = require("./babel-express.http-client");
let BabelGeoSyncService = BabelGeoSyncService_1 = class BabelGeoSyncService {
    prisma;
    http;
    encryption;
    logger = new common_1.Logger(BabelGeoSyncService_1.name);
    constructor(prisma, http, encryption) {
        this.prisma = prisma;
        this.http = http;
        this.encryption = encryption;
    }
    async syncFromBabel() {
        const credentials = await this.requireBabelCredentials();
        const syncedAt = new Date();
        const citiesRaw = await this.http.post('getCities', credentials, {});
        const citiesSrc = citiesRaw.cities ?? [];
        const cities = [];
        const areas = [];
        const hoods = [];
        for (const city of citiesSrc) {
            cities.push({ id: city.id, name: city.name });
            const areasRaw = await this.http.post('getAreas', credentials, { cityID: city.id });
            for (const area of areasRaw.areas ?? []) {
                areas.push({ id: area.id, cityId: city.id, name: area.name });
                const hoodsRaw = await this.http.post('getNeighbourhoods', credentials, { areaID: area.id });
                for (const hood of hoodsRaw.neighbourhoods ?? []) {
                    hoods.push({ id: hood.id, areaId: area.id, name: hood.name });
                }
            }
        }
        await this.prisma.$transaction(async (tx) => {
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
                const chunk = 500;
                for (let i = 0; i < hoods.length; i += chunk) {
                    await tx.babelNeighbourhood.createMany({
                        data: hoods.slice(i, i + chunk).map((h) => ({ ...h, syncedAt })),
                    });
                }
            }
        }, { timeout: 120_000 });
        this.logger.log(`Babel geo snapshot refreshed: cities=${cities.length} areas=${areas.length} neighbourhoods=${hoods.length}`);
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
    async listAreas(cityId) {
        return this.prisma.babelArea.findMany({
            where: { cityId },
            orderBy: { name: 'asc' },
        });
    }
    async listNeighbourhoods(areaId) {
        return this.prisma.babelNeighbourhood.findMany({
            where: { areaId },
            orderBy: { name: 'asc' },
        });
    }
    async findNeighbourhoodById(id) {
        return this.prisma.babelNeighbourhood.findUnique({
            where: { id },
            include: { area: { include: { city: true } } },
        });
    }
    async snapshotMeta() {
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
    async requireBabelCredentials() {
        const provider = await this.prisma.shippingProvider.findUnique({
            where: { code: shipping_constants_1.BABEL_EXPRESS_CODE },
            include: { connection: true },
        });
        const conn = provider?.connection;
        if (!conn ||
            conn.status !== client_1.ShippingProviderConnectionStatus.connected ||
            !conn.encryptedUsername ||
            !conn.encryptedPassword) {
            throw new Error('Babel Express is not connected.');
        }
        return {
            username: this.encryption.decrypt(conn.encryptedUsername),
            password: this.encryption.decrypt(conn.encryptedPassword),
        };
    }
};
exports.BabelGeoSyncService = BabelGeoSyncService;
exports.BabelGeoSyncService = BabelGeoSyncService = BabelGeoSyncService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        babel_express_http_client_1.BabelExpressHttpClient,
        encryption_service_1.EncryptionService])
], BabelGeoSyncService);
//# sourceMappingURL=babel-geo-sync.service.js.map