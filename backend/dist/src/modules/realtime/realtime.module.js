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
exports.RealtimeModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_module_1 = require("../../common/prisma/prisma.module");
const redis_module_1 = require("../../common/redis/redis.module");
const presence_service_1 = require("./presence.service");
const realtime_gateway_1 = require("./realtime.gateway");
const realtime_service_1 = require("./realtime.service");
const realtime_version_controller_1 = require("./realtime-version.controller");
const module_versions_service_1 = require("./sync/module-versions.service");
const mutation_bus_service_1 = require("./sync/mutation-bus.service");
const mutation_queue_service_1 = require("./sync/mutation-queue.service");
const realtime_sync_mode_service_1 = require("./sync/realtime-sync-mode.service");
let RealtimeModule = class RealtimeModule {
    realtime;
    queue;
    constructor(realtime, queue) {
        this.realtime = realtime;
        this.queue = queue;
    }
    onModuleInit() {
        this.realtime.attachMutationQueue(this.queue);
    }
};
exports.RealtimeModule = RealtimeModule;
exports.RealtimeModule = RealtimeModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [config_1.ConfigModule, prisma_module_1.PrismaModule, redis_module_1.RedisModule],
        controllers: [realtime_version_controller_1.RealtimeVersionController],
        providers: [
            realtime_gateway_1.RealtimeGateway,
            realtime_service_1.RealtimeService,
            presence_service_1.PresenceService,
            realtime_sync_mode_service_1.RealtimeSyncModeService,
            module_versions_service_1.ModuleVersionsService,
            mutation_queue_service_1.MutationQueueService,
            mutation_bus_service_1.MutationBusService,
        ],
        exports: [realtime_service_1.RealtimeService, presence_service_1.PresenceService, mutation_bus_service_1.MutationBusService, realtime_sync_mode_service_1.RealtimeSyncModeService],
    }),
    __metadata("design:paramtypes", [realtime_service_1.RealtimeService,
        mutation_queue_service_1.MutationQueueService])
], RealtimeModule);
//# sourceMappingURL=realtime.module.js.map