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
exports.MutationBusService = void 0;
const common_1 = require("@nestjs/common");
const mutation_queue_service_1 = require("./mutation-queue.service");
const realtime_sync_mode_service_1 = require("./realtime-sync-mode.service");
let MutationBusService = class MutationBusService {
    queue;
    mode;
    constructor(queue, mode) {
        this.queue = queue;
        this.mode = mode;
    }
    publish(input) {
        if (!this.mode.emitSystemVersion())
            return;
        this.queue.enqueue({
            mutationId: input.mutationId,
            companyId: input.companyId,
            userId: input.userId,
        });
    }
};
exports.MutationBusService = MutationBusService;
exports.MutationBusService = MutationBusService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [mutation_queue_service_1.MutationQueueService,
        realtime_sync_mode_service_1.RealtimeSyncModeService])
], MutationBusService);
//# sourceMappingURL=mutation-bus.service.js.map