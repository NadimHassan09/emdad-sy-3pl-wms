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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BabelAddressAdapter = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../../common/prisma/prisma.service");
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