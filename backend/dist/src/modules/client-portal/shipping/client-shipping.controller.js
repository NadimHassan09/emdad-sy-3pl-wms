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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientShippingController = void 0;
const common_1 = require("@nestjs/common");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const public_decorator_1 = require("../../../common/auth/public.decorator");
const encryption_service_1 = require("../../../common/crypto/encryption.service");
const prisma_service_1 = require("../../../common/prisma/prisma.service");
const babel_express_adapter_1 = require("../../shipping/providers/babel-express/babel-express.adapter");
const address_resolve_service_1 = require("../../shipping/address-resolve.service");
const shipping_constants_1 = require("../../shipping/shipping.constants");
const shipping_service_1 = require("../../shipping/shipping.service");
const jwt_client_auth_guard_1 = require("../auth/jwt-client-auth.guard");
const resolve_address_from_pin_dto_1 = require("../../shipping/dto/resolve-address-from-pin.dto");
const resolve_address_from_names_dto_1 = require("../../shipping/dto/resolve-address-from-names.dto");
class ResolveBabelNeighbourhoodDto {
    lat;
    lng;
}
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ResolveBabelNeighbourhoodDto.prototype, "lat", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ResolveBabelNeighbourhoodDto.prototype, "lng", void 0);
let ClientShippingController = class ClientShippingController {
    shipping;
    babelAdapter;
    addressResolve;
    prisma;
    encryption;
    constructor(shipping, babelAdapter, addressResolve, prisma, encryption) {
        this.shipping = shipping;
        this.babelAdapter = babelAdapter;
        this.addressResolve = addressResolve;
        this.prisma = prisma;
        this.encryption = encryption;
    }
    async getBoundary(governorate, city, neighborhood) {
        const row = await this.shipping.lookupAreaBoundary({
            governorate,
            city,
            neighborhood,
        });
        if (!row) {
            return { found: false, geometry: null, bbox: null };
        }
        return { found: true, ...row };
    }
    resolveAddressFromPin(body) {
        return this.addressResolve.resolveFromPin(body.lat, body.lng);
    }
    resolveAddressFromNames(body) {
        return this.addressResolve.resolveFromAddress({
            governorate: body.governorate,
            cityRegion: body.cityRegion,
            townNeighborhood: body.townNeighborhood,
        });
    }
    async resolveNeighbourhood(body) {
        try {
            const credentials = await this.requireBabelCredentials();
            const found = await this.babelAdapter.findNeighbourhoodByCoordinates(credentials, body.lat, body.lng);
            if (!found) {
                return { found: false, neighbourhood: null };
            }
            return { found: true, neighbourhood: found };
        }
        catch {
            return { found: false, neighbourhood: null };
        }
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
exports.ClientShippingController = ClientShippingController;
__decorate([
    (0, common_1.Get)('geo/boundary'),
    __param(0, (0, common_1.Query)('governorate')),
    __param(1, (0, common_1.Query)('city')),
    __param(2, (0, common_1.Query)('neighborhood')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], ClientShippingController.prototype, "getBoundary", null);
__decorate([
    (0, common_1.Post)('address/resolve-from-pin'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [resolve_address_from_pin_dto_1.ResolveAddressFromPinDto]),
    __metadata("design:returntype", void 0)
], ClientShippingController.prototype, "resolveAddressFromPin", null);
__decorate([
    (0, common_1.Post)('address/resolve-from-names'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [resolve_address_from_names_dto_1.ResolveAddressFromNamesDto]),
    __metadata("design:returntype", void 0)
], ClientShippingController.prototype, "resolveAddressFromNames", null);
__decorate([
    (0, common_1.Post)('babel/resolve-neighbourhood'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ResolveBabelNeighbourhoodDto]),
    __metadata("design:returntype", Promise)
], ClientShippingController.prototype, "resolveNeighbourhood", null);
exports.ClientShippingController = ClientShippingController = __decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(jwt_client_auth_guard_1.JwtClientAuthGuard),
    (0, common_1.Controller)('client/shipping'),
    __metadata("design:paramtypes", [shipping_service_1.ShippingService,
        babel_express_adapter_1.BabelExpressAdapter,
        address_resolve_service_1.AddressResolveService,
        prisma_service_1.PrismaService,
        encryption_service_1.EncryptionService])
], ClientShippingController);
//# sourceMappingURL=client-shipping.controller.js.map