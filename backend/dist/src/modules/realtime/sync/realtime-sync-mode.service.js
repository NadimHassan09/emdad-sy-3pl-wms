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
var RealtimeSyncModeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeSyncModeService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let RealtimeSyncModeService = RealtimeSyncModeService_1 = class RealtimeSyncModeService {
    log = new common_1.Logger(RealtimeSyncModeService_1.name);
    mode;
    constructor(config) {
        const raw = (config.get('REALTIME_SYNC_MODE') ?? 'dual').trim().toLowerCase();
        if (raw === 'legacy' || raw === 'dual' || raw === 'canonical') {
            this.mode = raw;
        }
        else {
            this.log.warn(`Invalid REALTIME_SYNC_MODE="${raw}" — defaulting to dual`);
            this.mode = 'dual';
        }
        this.log.log(`Realtime sync mode: ${this.mode}`);
    }
    getMode() {
        return this.mode;
    }
    emitLegacy() {
        return this.mode === 'legacy' || this.mode === 'dual';
    }
    emitSystemVersion() {
        return this.mode === 'dual' || this.mode === 'canonical';
    }
};
exports.RealtimeSyncModeService = RealtimeSyncModeService;
exports.RealtimeSyncModeService = RealtimeSyncModeService = RealtimeSyncModeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], RealtimeSyncModeService);
//# sourceMappingURL=realtime-sync-mode.service.js.map