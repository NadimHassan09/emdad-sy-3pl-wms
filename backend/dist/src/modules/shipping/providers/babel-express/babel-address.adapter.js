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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BabelAddressAdapter = void 0;
exports.lookupBabelNeighbourhoodIdFromIndex = lookupBabelNeighbourhoodIdFromIndex;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../../common/prisma/prisma.service");
const babel_address_index_json_1 = __importDefault(require("../../../../data/syria-locations/babel-address-index.json"));
const INDEX_SEP = '\u001f';
function lookupBabelNeighbourhoodIdFromIndex(index, input) {
    const entries = index.entries ?? {};
    const exact = entries[[input.governorate, input.cityRegion, input.townNeighborhood].join(INDEX_SEP)];
    if (typeof exact === 'number' && Number.isFinite(exact))
        return exact;
    const hits = [];
    for (const [key, id] of Object.entries(entries)) {
        const parts = key.split(INDEX_SEP);
        if (parts.length < 3)
            continue;
        if (parts[0] !== input.governorate || parts[2] !== input.townNeighborhood)
            continue;
        if (parts[1] !== input.cityRegion && input.cityRegion !== input.townNeighborhood)
            continue;
        if (typeof id !== 'number' || !Number.isFinite(id))
            continue;
        hits.push(id);
    }
    return hits.length === 1 ? hits[0] : null;
}
let BabelAddressAdapter = class BabelAddressAdapter {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async resolveNeighbourhoodId(input) {
        const gov = input.governorate?.trim();
        const area = input.cityRegion?.trim();
        const hood = input.townNeighborhood?.trim();
        if (!gov || !area || !hood)
            return null;
        const fromDb = await this.resolveFromSnapshot(gov, area, hood);
        if (fromDb != null)
            return fromDb;
        return lookupBabelNeighbourhoodIdFromIndex(babel_address_index_json_1.default, {
            governorate: gov,
            cityRegion: area,
            townNeighborhood: hood,
        });
    }
    async resolveFromSnapshot(gov, area, hood) {
        const city = await this.prisma.babelCity.findFirst({
            where: { name: gov },
            select: { id: true },
        });
        if (!city)
            return null;
        const babelArea = await this.prisma.babelArea.findFirst({
            where: { cityId: city.id, name: area },
            select: { id: true },
        });
        if (!babelArea)
            return null;
        const neighbourhood = await this.prisma.babelNeighbourhood.findFirst({
            where: { areaId: babelArea.id, name: hood },
            select: { id: true },
        });
        return neighbourhood?.id ?? null;
    }
    async validateNeighbourhoodId(id, location) {
        const gov = location.governorate?.trim();
        const nb = await this.prisma.babelNeighbourhood.findUnique({
            where: { id },
            include: { area: { include: { city: true } } },
        });
        if (nb) {
            if (gov && nb.area?.city?.name && nb.area.city.name !== gov) {
                return false;
            }
            return true;
        }
        const entries = babel_address_index_json_1.default.entries;
        if (entries) {
            let foundMatchingId = false;
            for (const [key, entryId] of Object.entries(entries)) {
                if (entryId === id) {
                    foundMatchingId = true;
                    const parts = key.split(INDEX_SEP);
                    if (gov && parts[0] && parts[0] !== gov) {
                        continue;
                    }
                    return true;
                }
            }
            if (foundMatchingId) {
                return false;
            }
        }
        return false;
    }
    async isBabelCovered(input) {
        return (await this.resolveNeighbourhoodId(input)) != null;
    }
};
exports.BabelAddressAdapter = BabelAddressAdapter;
exports.BabelAddressAdapter = BabelAddressAdapter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BabelAddressAdapter);
//# sourceMappingURL=babel-address.adapter.js.map