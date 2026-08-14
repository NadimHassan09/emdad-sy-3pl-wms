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
exports.ShippingProviderRegistry = exports.BABEL_EXPRESS_CODE = void 0;
const common_1 = require("@nestjs/common");
const babel_express_adapter_1 = require("./providers/babel-express/babel-express.adapter");
var shipping_constants_1 = require("./shipping.constants");
Object.defineProperty(exports, "BABEL_EXPRESS_CODE", { enumerable: true, get: function () { return shipping_constants_1.BABEL_EXPRESS_CODE; } });
let ShippingProviderRegistry = class ShippingProviderRegistry {
    byCode = new Map();
    constructor(babel) {
        this.byCode.set(babel.code, babel);
    }
    get(code) {
        const provider = this.byCode.get(code);
        if (!provider) {
            throw new common_1.NotFoundException(`Shipping provider "${code}" is not registered.`);
        }
        return provider;
    }
    has(code) {
        return this.byCode.has(code);
    }
    listCodes() {
        return [...this.byCode.keys()];
    }
};
exports.ShippingProviderRegistry = ShippingProviderRegistry;
exports.ShippingProviderRegistry = ShippingProviderRegistry = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [babel_express_adapter_1.BabelExpressAdapter])
], ShippingProviderRegistry);
//# sourceMappingURL=shipping-provider.registry.js.map