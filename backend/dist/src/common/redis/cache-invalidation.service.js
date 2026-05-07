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
exports.CacheInvalidationService = void 0;
const common_1 = require("@nestjs/common");
const redis_service_1 = require("./redis.service");
const cache_invalidation_map_1 = require("./cache-invalidation.map");
let CacheInvalidationService = class CacheInvalidationService {
    redis;
    constructor(redis) {
        this.redis = redis;
    }
    async afterStockOrLedgerMutation() {
        await Promise.all([...cache_invalidation_map_1.INVALIDATION_BY_TRIGGER.stockOrLedger].map((p) => this.redis.deleteByPrefix(p)));
    }
    async afterTaskMutation() {
        await Promise.all([...cache_invalidation_map_1.INVALIDATION_BY_TRIGGER.warehouseTaskOrWorkflowUi].map((p) => this.redis.deleteByPrefix(p)));
    }
    async afterTaskAndStockMutation() {
        await Promise.all([...cache_invalidation_map_1.INVALIDATION_BY_TRIGGER.taskAndStock].map((p) => this.redis.deleteByPrefix(p)));
    }
    async invalidateProducts() {
        await this.redis.deleteByPrefix(cache_invalidation_map_1.CACHE_PREFIX.products);
    }
    async invalidateLocationTrees() {
        await this.redis.deleteByPrefix(cache_invalidation_map_1.CACHE_PREFIX.locations);
    }
    async invalidateBarcodeKey(normalizedBarcode) {
        await this.redis.del(`barcode:${normalizedBarcode}`);
    }
};
exports.CacheInvalidationService = CacheInvalidationService;
exports.CacheInvalidationService = CacheInvalidationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService])
], CacheInvalidationService);
//# sourceMappingURL=cache-invalidation.service.js.map